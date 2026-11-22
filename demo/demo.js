/**
 * Interactive demo: pick a task, generate a model's weights from its three examples,
 * then run that generated model on inputs you choose or edit. Everything runs in the
 * browser with demo/hypernet.js; rendered by the `custom` block type (template/js/blocks.js).
 */
(function () {
  "use strict";

  // The paper figures' palette (visualisation/paper/arc_paper.py in on-the-fly-models).
  const COLORS = ["#CDBFA3", "#B2524A", "#C97A3D", "#C9A227", "#7C8F4A",
                  "#2F8F82", "#4C6E96", "#4B4B80", "#6B4C93", "#8C4A73"];

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // One sequence as a row of cells. `onCell` makes the cells clickable buttons.
  function row(values, opts) {
    opts = opts || {};
    const r = el("div", "otf-row");
    r.style.setProperty("--n", values.length);
    values.forEach(function (v, i) {
      const c = el(opts.onCell ? "button" : "span", "otf-cell");
      if (v == null) { c.classList.add("otf-unknown"); c.textContent = "?"; }
      else c.style.setProperty("--c", COLORS[v]);
      if (opts.onCell) {
        c.type = "button";
        c.setAttribute("aria-label", "Cell " + (i + 1) + ", colour " + v);
        c.addEventListener("click", function () { opts.onCell(i); });
      }
      r.appendChild(c);
    });
    return r;
  }

  // Click on an editable cell: paint it with the chosen colour; clicking it again
  // undoes that, restoring the task's original value (background 0 if that was
  // already the chosen colour).
  function paintCell(current, original, paint) {
    if (current !== paint) return paint;
    return original !== paint ? original : 0;
  }

  // Colour picker shared by every editable row.
  function palette(state, label, onPick) {
    const box = el("div", "otf-palette");
    box.appendChild(el("span", "otf-hint", label));
    COLORS.forEach(function (_, v) {
      const s = el("button", "otf-cell otf-swatch");
      s.type = "button";
      s.style.setProperty("--c", COLORS[v]);
      s.setAttribute("aria-label", "Paint colour " + v);
      s.setAttribute("aria-pressed", String(state.paint === v));
      s.addEventListener("click", function () { state.paint = v; onPick(); });
      box.appendChild(s);
    });
    return box;
  }

  function labelled(label, content) {
    const line = el("div", "otf-line");
    line.appendChild(el("span", "otf-label", label));
    line.appendChild(content);
    return line;
  }

  // t-SNE map of the task vectors z of 1,400 held-out episodes (from export_weights.py),
  // styled like the paper's figure: paper palette per task, see-through dots, serif labels, light
  // grid, left/bottom axes only. A new model is a star at the inverse-distance-weighted mean
  // position of its k nearest episodes in z: t-SNE cannot add a point to a finished map.
  function taskMap(canvas, tip, map, categories) {
    const K = 10, PAD = 14;
    let marker = null, from = null, start = 0, hover = -1;
    const css = function (name) { return getComputedStyle(canvas).getPropertyValue(name).trim(); };
    // Dot radius scales with the canvas; dots are inset from the axes so none cross them.
    const radius = function (size) { return Math.max(3, size * 0.018); };
    const toPx = function (xy, size) {
      const m = PAD + 1.5 * radius(size), span = size - 2 * m;
      return [m + xy[0] * span, m + (1 - xy[1]) * span];
    };

    function star(ctx, x, y, r) {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
        ctx.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a));
      }
      ctx.closePath();
    }

    function draw(now) {
      const size = canvas.clientWidth, ratio = window.devicePixelRatio || 1;
      if (!size) return;
      canvas.width = canvas.height = size * ratio;
      const ctx = canvas.getContext("2d");
      ctx.scale(ratio, ratio);
      // Grid (alpha 0.25) and the left/bottom axes, as in the paper figure.
      ctx.strokeStyle = css("--color-text");
      ctx.globalAlpha = 0.12; ctx.lineWidth = 0.6;
      for (let g = 0; g <= 4; g++) {
        const v = PAD + g * (size - 2 * PAD) / 4;
        ctx.beginPath(); ctx.moveTo(v, PAD); ctx.lineTo(v, size - PAD); ctx.moveTo(PAD, v); ctx.lineTo(size - PAD, v); ctx.stroke();
      }
      ctx.globalAlpha = 0.6; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD, PAD); ctx.lineTo(PAD, size - PAD); ctx.lineTo(size - PAD, size - PAD); ctx.stroke();
      // Points: a bit larger than the paper figure's markers. Each task is drawn opaque on its
      // own layer, then composited see-through: each blob is ~20 overlapping colour variants of
      // one puzzle, so per-dot alpha would stack back to opaque. While a task is highlighted,
      // the others are grey and the highlighted task is drawn last.
      const r = radius(size), grey = css("--color-border");
      const layer = document.createElement("canvas");
      layer.width = layer.height = size * ratio;
      const lctx = layer.getContext("2d");
      lctx.scale(ratio, ratio);
      const order = categories.map(function (_, c) { return c; })
        .sort(function (a, b) { return (a === hover) - (b === hover); });
      order.forEach(function (c) {
        const other = hover >= 0 && c !== hover;
        lctx.clearRect(0, 0, size, size);
        lctx.fillStyle = other ? grey : categories[c].color;
        map.xy.forEach(function (xy, i) {
          if (map.category[i] !== c) return;
          const q = toPx(xy, size);
          lctx.beginPath(); lctx.arc(q[0], q[1], r, 0, 2 * Math.PI); lctx.fill();
        });
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = other ? 0.5 : 0.55;
        ctx.drawImage(layer, 0, 0);
        ctx.restore();
      });
      if (!marker) return;
      const t = Math.min(1, (now - start) / 700), ease = 1 - Math.pow(1 - t, 3);
      const q = toPx([from[0] + (marker[0] - from[0]) * ease, from[1] + (marker[1] - from[1]) * ease], size);
      // See-through fill with a solid outline, so the dots under the star stay visible.
      star(ctx, q[0], q[1], Math.max(13, r * 4));
      ctx.fillStyle = ctx.strokeStyle = css("--color-text");
      ctx.globalAlpha = 0.35; ctx.fill();
      ctx.globalAlpha = 1; ctx.lineWidth = 1.5; ctx.lineJoin = "round";
      ctx.stroke();
      if (t < 1) requestAnimationFrame(draw);
    }

    function place(z) {
      if (!z) { marker = null; draw(); return; }
      const near = map.z.map(function (r, i) {
        return [Math.hypot.apply(null, r.map(function (v, j) { return v - z[j]; })), i];
      }).sort(function (a, b) { return a[0] - b[0]; }).slice(0, K);
      let wsum = 0, x = 0, y = 0;
      near.forEach(function (n) {
        const w = 1 / (n[0] + 1e-6);
        wsum += w; x += w * map.xy[n[1]][0]; y += w * map.xy[n[1]][1];
      });
      from = marker || [0.5, 0.5];
      marker = [x / wsum, y / wsum];
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      start = reduce ? -Infinity : performance.now();
      requestAnimationFrame(draw);
      return map.category[near[0][1]];
    }

    function highlight(c) { if (c !== hover) { hover = c; draw(Infinity); } }

    // Hover: name the task of the nearest point in a tooltip and highlight that task.
    canvas.addEventListener("mousemove", function (ev) {
      const rect = canvas.getBoundingClientRect(), size = canvas.clientWidth;
      const mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
      let best = -1, bestD = 12;
      map.xy.forEach(function (xy, i) {
        const q = toPx(xy, size), d = Math.hypot(q[0] - mx, q[1] - my);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best < 0) { tip.hidden = true; return highlight(-1); }
      tip.textContent = categories[map.category[best]].label;
      tip.style.left = mx + "px"; tip.style.top = my + "px";
      tip.hidden = false;
      highlight(map.category[best]);
    });
    canvas.addEventListener("mouseleave", function () { tip.hidden = true; highlight(-1); });
    window.addEventListener("resize", function () { draw(Infinity); });
    // Colours come from CSS variables read at draw time, so redraw when the theme toggles.
    new MutationObserver(function () { draw(Infinity); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "style"] });
    requestAnimationFrame(function () { draw(Infinity); });
    return { place: place, highlight: highlight, clear: function () { marker = null; draw(Infinity); } };
  }

  // One legend for both maps, as in the paper figure. Hovering an entry highlights that task.
  function legend(categories, maps) {
    const box = el("div", "otf-legend");
    categories.map(function (c, i) { return [c, i]; })
      .sort(function (a, b) { return a[0].label.localeCompare(b[0].label); })
      .forEach(function (ci) {
        const item = el("span", "otf-legend-item", ci[0].label);
        item.style.setProperty("--c", ci[0].color);
        item.addEventListener("mouseenter", function () { maps.forEach(function (m) { m.highlight(ci[1]); }); });
        item.addEventListener("mouseleave", function () { maps.forEach(function (m) { m.highlight(-1); }); });
        box.appendChild(item);
      });
    return box;
  }

  window.renderOnTheFlyDemo = function (container, block) {
    container.classList.add("otf-demo");
    return fetch(block.weights)
      .then(function (res) {
        if (!res.ok) throw new Error(block.weights + " responded " + res.status);
        return res.json();
      })
      .then(function (data) { build(container, data); });
  };

  function build(container, data) {
    // One entry per hypernetwork, with task ID on the left.
    const models = data.models.map(function (m, k) {
      return { m: OnTheFly.create(m), usesTaskId: m.uses_task_id, map: m.map, k: k,
               name: m.uses_task_id ? "With task ID" : "Without task ID" };
    }).sort(function (a, b) { return b.usesTaskId - a.usesTaskId; });
    // support: the (editable) three examples.
    const state = { task: null, support: null, examplesEdited: false,
                    weights: null, query: 0, input: null, edited: false, paint: 1 };
    const copySupport = function (p) {
      return [p.support_inputs, p.support_outputs].map(function (rows) {
        return rows.map(function (r) { return r.slice(); });
      });
    };

    const tabs = el("div", "otf-tabs");
    tabs.setAttribute("role", "group");
    tabs.setAttribute("aria-label", "Task");
    const support = el("div", "otf-step");
    const generateStep = el("div", "otf-step");
    const runStep = el("div", "otf-step");
    container.append(tabs, support, generateStep, runStep);

    data.presets.forEach(function (preset, i) {
      const b = el("button", "btn otf-tab", preset.label);
      b.type = "button";
      b.addEventListener("click", function () { selectTask(i); });
      tabs.appendChild(b);
    });

    // --- Step 1: the three examples --------------------------------------------
    // Every cell is editable; each edit regenerates both models (if generated already).
    function renderSupport() {
      support.replaceChildren(el("h3", "otf-step-title", "1. Three examples of the task"));
      const tools = palette(state, "Edit the examples: pick a colour, then click cells.", function () { renderSupport(); renderRun(); });
      const reset = el("button", "btn otf-small", "Reset examples");
      reset.type = "button";
      reset.disabled = !state.examplesEdited;
      reset.addEventListener("click", function () {
        state.support = copySupport(state.task);
        state.examplesEdited = false;
        renderSupport();
        if (state.weights) generate();
      });
      tools.appendChild(reset);
      support.appendChild(tools);
      for (let e = 0; e < 3; e++) {
        const pair = el("div", "otf-pair");
        [0, 1].forEach(function (side) {
          const seq = state.support[side][e];
          pair.appendChild(labelled((side ? "y" : "x") + (e + 1), row(seq, {
            onCell: function (i) {
              const orig = (side ? state.task.support_outputs : state.task.support_inputs)[e][i];
              seq[i] = paintCell(seq[i], orig, state.paint);
              state.examplesEdited = true;
              renderSupport();
              if (state.weights) generate();
            },
          })));
        });
        support.appendChild(pair);
      }
    }

    // --- Step 2: both hypernetworks write a model --------------------------------
    const genButton = el("button", "btn otf-primary", "Generate both models' weights");
    genButton.type = "button";
    const columns = el("div", "otf-columns");
    const panels = models.map(function (model) {
      const col = el("div", "otf-column");
      const mapCanvas = el("canvas", "otf-map");
      mapCanvas.setAttribute("role", "img");
      mapCanvas.setAttribute("aria-label", model.name + ": t-SNE map of the task vectors of " +
        model.map.xy.length + " models generated for held-out episodes, coloured by task; the new model is the star.");
      const tip = el("span", "otf-tip");
      tip.hidden = true;
      const frame = el("div", "otf-map-frame");
      frame.append(mapCanvas, tip);
      const nearest = el("p", "otf-hint otf-nearest");
      col.append(el("h4", "otf-model-name", model.name), frame, nearest);
      columns.appendChild(col);
      return { map: taskMap(mapCanvas, tip, model.map, data.categories), nearest: nearest };
    });
    generateStep.append(el("h3", "otf-step-title", "2. Generate two models"),
                        genButton, columns,
                        legend(data.categories, panels.map(function (p) { return p.map; })));
    function generate() {
      state.weights = models.map(function (model, k) {
        const z = model.m.encode(state.support[0], state.support[1], state.task.task_index);
        const c = panels[k].map.place(z);
        panels[k].nearest.textContent = "Star lands nearest to: " + data.categories[c].label;
        return model.m.decode(z);
      });
      renderRun();
    }
    genButton.addEventListener("click", generate);

    // --- Step 3: run both generated models on the same new input -----------------
    function renderRun() {
      const p = state.task;
      runStep.replaceChildren(el("h3", "otf-step-title", "3. Run both models on a new input"));

      const picks = el("div", "otf-picks");
      picks.appendChild(el("span", "otf-hint", "New input:"));
      p.queries.forEach(function (q, i) {
        const b = el("button", "btn otf-small", String(i + 1));
        b.type = "button";
        b.setAttribute("aria-label", "Input " + (i + 1));
        b.setAttribute("aria-pressed", String(!state.edited && state.query === i));
        b.addEventListener("click", function () { setQuery(i); });
        picks.appendChild(b);
      });
      const reset = el("button", "btn otf-small", "Reset");
      reset.type = "button";
      reset.addEventListener("click", function () { setQuery(state.query); });
      picks.appendChild(reset);
      runStep.appendChild(picks);

      runStep.appendChild(palette(state, "Or paint your own:", function () { renderRun(); renderSupport(); }));

      runStep.appendChild(labelled("x′", row(state.input, {
        onCell: function (i) {
          state.input[i] = paintCell(state.input[i], state.task.queries[state.query].input[i], state.paint);
          state.edited = true;
          renderRun();
        },
      })));

      const expected = state.edited ? null : p.queries[state.query].output;
      if (expected) runStep.appendChild(labelled("y′", row(expected)));

      models.forEach(function (model, k) {
        const caption = el("p", "otf-caption");
        caption.appendChild(el("strong", null, model.name));
        runStep.appendChild(caption);
        if (!state.weights) {
          runStep.appendChild(labelled("ŷ′", row(state.input.map(function () { return null; }))));
          caption.append(": generate weights first");
          return;
        }
        const prediction = model.m.predict(state.weights[k], state.input);
        const wrong = expected && prediction.map(function (v, i) { return v !== expected[i]; });
        runStep.appendChild(labelled("ŷ′", row(prediction, { wrong: wrong })));
        if (expected) {
          const n = wrong.filter(Boolean).length;
          caption.append(": " + (n === 0 ? "✓ correct" : "✗ " + n + " cell" + (n > 1 ? "s" : "") + " wrong"));
        }
      });

    }

    function setQuery(i) {
      state.query = i;
      state.input = state.task.queries[i].input.slice();
      state.edited = false;
      renderRun();
    }

    function selectTask(i) {
      state.task = data.presets[i];
      state.support = copySupport(state.task);
      state.examplesEdited = false;
      state.weights = null;
      Array.from(tabs.children).forEach(function (b, j) { b.setAttribute("aria-pressed", String(i === j)); });
      panels.forEach(function (panel) {
        panel.map.clear();
        panel.nearest.textContent = "";
      });
      renderSupport();
      setQuery(0);
    }

    selectTask(Math.max(0, data.presets.findIndex(function (p) { return p.category === "flip"; })));
  }
})();
