/**
 * Plain-JS forward pass of the on-the-fly hypernetwork (no libraries).
 *
 * Mirrors the on-the-fly-models repo: models/transformer.py (pre-norm Transformer with
 * RoPE and Canon layers), models/hypernetwork.py (attention pooling + weight decoder) and
 * HypernetworkLightning.embed_context. Tensors are plain nested arrays: a sequence is
 * [seq_len][dim], a weight is [out][in] like torch's nn.Linear.
 *
 * Works as a browser <script> (sets window.OnTheFly) and under Node (module.exports).
 */
(function (root) {
  "use strict";

  const linear = (x, W) => x.map((v) => W.map((row) => row.reduce((s, w, i) => s + w * v[i], 0)));
  const add = (a, b) => a.map((r, t) => r.map((v, i) => v + b[t][i]));
  const silu = (v) => v / (1 + Math.exp(-v));
  const gelu = (v) => 0.5 * v * (1 + erf(v / Math.SQRT2));

  // Abramowitz & Stegun 7.1.26 (|error| < 1.5e-7), enough to match torch's exact GELU.
  function erf(x) {
    const s = Math.sign(x), a = Math.abs(x), t = 1 / (1 + 0.3275911 * a);
    const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
    return s * y;
  }

  function softmax(v) {
    const m = Math.max(...v), e = v.map((x) => Math.exp(x - m)), z = e.reduce((a, b) => a + b, 0);
    return e.map((x) => x / z);
  }

  function layerNorm(x, w, b) {
    return x.map((v) => {
      const mean = v.reduce((a, c) => a + c, 0) / v.length;
      const variance = v.reduce((a, c) => a + (c - mean) ** 2, 0) / v.length;
      const inv = 1 / Math.sqrt(variance + 1e-5);
      return v.map((c, i) => (c - mean) * inv * w[i] + (b ? b[i] : 0));
    });
  }

  // CanonConv: centred depthwise conv (kernel [C][1][K]), then x + silu(conv).
  function canon(x, kernel) {
    const K = kernel[0][0].length, half = (K - 1) / 2;
    return x.map((v, t) => v.map((c, ch) => {
      let s = 0;
      for (let k = 0; k < K; k++) {
        const j = t + k - half;
        if (j >= 0 && j < x.length) s += kernel[ch][0][k] * x[j][ch];
      }
      return c + silu(s);
    }));
  }

  // RoPE for one head of size d: [cos, cos] / [sin, sin] tables and rotate_half.
  function rope(v, pos) {
    const d = v.length, h = d / 2;
    return v.map((c, i) => {
      const theta = pos * Math.pow(10000, -(2 * (i % h)) / d);
      const rotated = i < h ? -v[i + h] : v[i - h];
      return c * Math.cos(theta) + rotated * Math.sin(theta);
    });
  }

  // Single-head bidirectional self-attention, no mask (padding is attended to, as in training).
  function attention(x, p, pre) {
    const d = x[0].length;
    const qkv = canon(linear(x, p[pre + "attn.c_attn.weight"]), p[pre + "attn.canon_b.weight"]);
    const q = qkv.map((r, t) => rope(r.slice(0, d), t));
    const k = qkv.map((r, t) => rope(r.slice(d, 2 * d), t));
    const v = qkv.map((r) => r.slice(2 * d));
    const out = q.map((qi) => {
      const a = softmax(k.map((kj) => kj.reduce((s, c, i) => s + c * qi[i], 0) / Math.sqrt(d)));
      return v[0].map((_, i) => a.reduce((s, aj, j) => s + aj * v[j][i], 0));
    });
    return linear(out, p[pre + "attn.c_proj.weight"]);
  }

  function block(x, p, pre) {
    let h = canon(layerNorm(x, p[pre + "ln_1.weight"]), p[pre + "canon_a.weight"]);
    x = add(x, attention(h, p, pre));
    h = canon(layerNorm(x, p[pre + "ln_2.weight"]), p[pre + "canon_c.weight"]);
    h = canon(linear(h, p[pre + "mlp.c_fc.weight"]), p[pre + "mlp.canon_d.weight"]);
    return add(x, linear(h.map((r) => r.map(gelu)), p[pre + "mlp.c_proj.weight"]));
  }

  function transformer(x, p, pre, numLayers) {
    let h = linear(x, p[pre + "input_projection.weight"]);
    for (let l = 0; l < numLayers; l++) h = block(h, p, pre + "blocks." + l + ".");
    h = layerNorm(h, p[pre + "final_norm.weight"], p[pre + "final_norm.bias"]);
    return linear(h, p[pre + "output_head.weight"]);
  }

  // Cut a flat vector into named tensors of the given shapes (Hypernetwork.split_weights).
  function split(flat, shapes) {
    const out = {};
    let offset = 0;
    const take = (shape) => shape.length === 1
      ? flat.slice(offset, (offset += shape[0]))
      : Array.from({ length: shape[0] }, () => take(shape.slice(1)));
    for (const [name, shape] of shapes) out[name] = take(shape);
    return out;
  }

  function create(model) {
    const p = model.params, L = model.pad_length;
    const pad = (seq) => seq.concat(Array(L - seq.length).fill(model.pad_value));
    const embed = (ids) => ids.map((id) => p["embedder.value_embedding.weight"][id]);

    /** Encoder: 3 support pairs (+ task index, if the model uses one) -> task vector z. */
    function encode(supportInputs, supportOutputs, taskIndex) {
      const ctx = [];
      for (let e = 0; e < 3; e++) {
        [supportInputs[e], supportOutputs[e]].forEach((seq, role) => {
          for (const id of pad(seq)) {
            ctx.push(p["embedder.value_embedding.weight"][id].map((v, i) =>
              v + p["embedder.example_embedding.weight"][e][i] + p["embedder.role_embedding.weight"][role][i]));
          }
        });
      }
      const tokens = transformer(ctx, p, "encoder.", model.encoder_layers);
      const query = p["pooler.query"];
      const a = softmax(tokens.map((t) => t.reduce((s, c, i) => s + c * query[i], 0)));
      const taskProj = p["task_indicator_proj.weight"];  // [encoder_dim][num_tasks]: one-hot @ W.T
      const z = query.map((_, i) => a.reduce((s, aj, j) => s + aj * tokens[j][i], 0) +
        (taskProj ? taskProj[i][taskIndex] : 0));
      return z;
    }

    /** Weight decoder: task vector z -> flat vector of every target weight. */
    function decode(z) {
      const hidden = linear([z], p["projection.0.weight"])[0].map(gelu);
      return linear([hidden], p["projection.2.weight"])[0];
    }

    /** Generated model: one input sequence -> predicted colour per cell. */
    function predict(flatWeights, input) {
      const w = split(flatWeights, model.target_shapes);
      const logits = transformer(embed(pad(input)), w, "", model.target_layers);
      return logits.slice(0, input.length).map((r) => r.indexOf(Math.max(...r)));
    }

    return { encode, decode, predict };
  }

  const api = { create };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.OnTheFly = api;
})(typeof window !== "undefined" ? window : globalThis);
