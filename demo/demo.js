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

  // One sequence as a row of cells. `onCell` makes the cells clickable buttons; `wrong` flags
  // the cells of a prediction that differ from the reference, which are then crossed.
  function row(values, opts) {
    opts = opts || {};
    const r = el("div", "otf-row");
    r.style.setProperty("--n", values.length);
    values.forEach(function (v, i) {
      const c = el(opts.onCell ? "button" : "span", "otf-cell");
      if (v == null) { c.classList.add("otf-unknown"); c.textContent = "?"; }
      else c.style.setProperty("--c", COLORS[v]);
      if (opts.wrong && opts.wrong[i]) c.classList.add("otf-wrong");
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

  // Editing tools shown under an editable graphic, the same in steps 1 and 3: the colour picker
  // in the middle and a reset button in the right corner, enabled once something was edited.
  function tools(state, hint, onPick, resetLabel, edited, onReset) {
    const box = el("div", "otf-tools");
    const reset = el("button", "btn otf-small", resetLabel);
    reset.type = "button";
    reset.disabled = !edited;
    reset.addEventListener("click", onReset);
    box.append(palette(state, hint, onPick), reset);
    return box;
  }

  // A row of preset buttons behind a short label, the same in steps 1 and 3.
  function presets(label, ariaLabel) {
    const box = el("div", "otf-presets");
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", ariaLabel);
    box.appendChild(el("span", "otf-hint", label));
    return box;
  }
  function preset(text, onClick) {
    const b = el("button", "btn otf-small otf-tab", text);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }

  // A row with its label typeset as in the paper: KaTeX (loaded by the page) sets the TeX, with
  // an optional subscript index, in Computer Modern. Without KaTeX it falls back to italic text.
  // `after` is an optional element shown to the right of the row.
  function labelled(tex, content, index, after) {
    const line = el("div", "otf-line");
    const label = el("span", "otf-label");
    if (window.katex) {
      window.katex.render(tex + (index != null ? "_" + index : ""), label, { throwOnError: false });
    } else {
      label.textContent = tex.replace("\\hat{y}", "ŷ").replace(/'/g, "′");
      if (index != null) label.appendChild(el("sub", null, String(index)));
    }
    line.append(label, content, after || el("span", "otf-after"));
    return line;
  }

  // Right of a prediction: a tick, or a cross with the number of wrong cells. The words are
  // dropped where the row leaves no room for them (long sequences, narrow screens).
  function verdict(wrongCount, length) {
    const ok = wrongCount === 0;
    const v = el("span", "otf-after otf-verdict " + (ok ? "otf-ok" : "otf-bad"), ok ? "✓" : "✗ " + wrongCount);
    v.appendChild(el("span", "otf-verdict-text", ok ? " correct" : " wrong"));
    if (length > 20) v.classList.add("otf-compact");
    v.setAttribute("role", "img");
    v.setAttribute("aria-label", ok ? "Correct" : wrongCount + " cell" + (wrongCount > 1 ? "s" : "") + " wrong");
    return v;
  }

  // t-SNE map of the task vectors z of 1,400 held-out episodes (from export_weights.py),
  // styled like the paper's figure: paper palette per task, see-through dots, serif labels, light
  // grid, left/bottom axes only. A new model is a star at the inverse-distance-weighted mean
  // position of its k nearest episodes in z: t-SNE cannot add a point to a finished map.
  function taskMap(canvas, tip, map, categories) {
    const K = 10, PAD = 14, EDGE = 1.25, FILL = 0.3;  // edge width; opacity of a dot's fill
    let marker = null, from = null, start = 0, hover = -1, fade = false;
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

    // The grid, axes and dots change only with the size, the highlighted task and the theme, so
    // they are painted into `scene` once and copied per frame: the star's animation then costs a
    // copy and one star, not 1,400 dots. `scene` and `layer` are reused, never recreated.
    const scene = document.createElement("canvas"), layer = document.createElement("canvas");
    let sceneKey = "";
    function paintScene(size, ratio) {
      scene.width = scene.height = layer.width = layer.height = size * ratio;
      const ctx = scene.getContext("2d");
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
      // Points: a bit larger than the paper figure's markers, styled like the cells: full-colour
      // edge, lighter see-through fill. Each task is drawn on its own layer, where a dot first erases
      // what is under it: each blob is ~20 overlapping colour variants of one puzzle, so stacked
      // see-through fills would turn opaque. While a task is highlighted, the others are grey
      // and the highlighted task is drawn last.
      const r = radius(size), grey = css("--color-border");
      const lctx = layer.getContext("2d");
      lctx.scale(ratio, ratio);
      lctx.lineWidth = EDGE;
      const order = categories.map(function (_, c) { return c; })
        .sort(function (a, b) { return (a === hover) - (b === hover); });
      order.forEach(function (c) {
        const other = hover >= 0 && c !== hover;
        lctx.clearRect(0, 0, size, size);
        lctx.fillStyle = lctx.strokeStyle = other ? grey : categories[c].color;
        map.xy.forEach(function (xy, i) {
          if (map.category[i] !== c) return;
          const q = toPx(xy, size);
          lctx.beginPath(); lctx.arc(q[0], q[1], r - EDGE / 2, 0, 2 * Math.PI);
          lctx.globalCompositeOperation = "destination-out"; lctx.globalAlpha = 1; lctx.fill();
          lctx.globalCompositeOperation = "source-over"; lctx.globalAlpha = FILL; lctx.fill();
          lctx.globalAlpha = 1; lctx.stroke();
        });
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = other ? 0.6 : 1;
        ctx.drawImage(layer, 0, 0);
        ctx.restore();
      });
    }

    function draw(now) {
      const size = canvas.clientWidth, ratio = window.devicePixelRatio || 1;
      if (!size) return;
      const key = [size, ratio, hover, css("--color-text"), css("--color-border")].join("|");
      if (key !== sceneKey) { paintScene(size, ratio); sceneKey = key; }
      canvas.width = canvas.height = size * ratio;  // also clears the canvas
      const ctx = canvas.getContext("2d");
      ctx.drawImage(scene, 0, 0);
      if (!marker) return;
      ctx.scale(ratio, ratio);
      const t = Math.min(1, (now - start) / 700), ease = 1 - Math.pow(1 - t, 3);
      const q = toPx([from[0] + (marker[0] - from[0]) * ease, from[1] + (marker[1] - from[1]) * ease], size);
      // See-through fill with a solid outline, so the dots under the star stay visible.
      star(ctx, q[0], q[1], Math.max(13, radius(size) * 4));
      ctx.fillStyle = ctx.strokeStyle = css("--color-text");
      const alpha = fade ? ease : 1;
      ctx.globalAlpha = 0.35 * alpha; ctx.fill();
      ctx.globalAlpha = alpha; ctx.lineWidth = 1.5; ctx.lineJoin = "round";
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
      // A first star fades in where it lands; later ones travel there from the previous spot.
      fade = !marker;
      from = marker || [x / wsum, y / wsum];
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

  // The example figure and the demo read the same file: it is downloaded once per page.
  const dataLoads = window.onTheFlyData = window.onTheFlyData || {};
  function loadData(url) {
    dataLoads[url] = dataLoads[url] || fetch(url).then(function (res) {
      if (!res.ok) throw new Error(url + " responded " + res.status);
      return res.json();
    });
    return dataLoads[url];
  }

  window.renderOnTheFlyDemo = function (container, block) {
    container.classList.add("otf-demo");
    return loadData(block.weights).then(function (data) { build(container, data); });
  };

  // Example-episode figure (further `custom` blocks, in the Motivation and generalisation
  // sections): the three example pairs and the query of one task, with a menu to look at any
  // other task. Read-only, drawn with the demo's cells. `weights` is any file with a `presets`
  // list: the demo's own (the 14 transformations) or compositions.json (the held-out
  // compositions). Block keys: `task` is the category shown first; `menu_label` names the menu;
  // in `caption`, {task} stands for the chosen preset's label and {first}, {second} for the
  // parts of a composition in the order they are applied.
  window.renderOnTheFlyEpisode = function (container, block) {
    return loadData(block.weights).then(function (data) {
      const figure = el("figure", "otf-demo otf-episode");
      const box = el("div", "otf-step"), pairs = el("div"), caption = el("figcaption");
      box.setAttribute("role", "img");
      const select = el("select", "otf-select");
      data.presets.forEach(function (p, i) {
        const option = el("option", null, p.label);
        option.value = String(i);
        select.appendChild(option);
      });
      const menu = el("label", "otf-hint otf-presets", block.menu_label || "Transformation:");
      menu.appendChild(select);

      // One line of the figure: input row, arrow, output row.
      const pair = function (x, y, index, yTex) {
        const line = el("div", "otf-episode-pair");
        const arrow = el("span", "otf-arrow", "→");
        arrow.setAttribute("aria-hidden", "true");
        line.append(labelled(index ? "x" : "x'", row(x), index), arrow, labelled(yTex || "y", row(y), index));
        return line;
      };
      function show(i) {
        const p = data.presets[i], query = p.queries[0].input;
        pairs.replaceChildren();
        for (let e = 0; e < 3; e++) pairs.appendChild(pair(p.support_inputs[e], p.support_outputs[e], e + 1));
        // The query's output is what the model must predict: shown as unknown cells.
        pairs.appendChild(pair(query, query.map(function () { return null; }), null, "\\hat{y}'"));
        // Long sequences do not fit side by side: each output goes under its input.
        pairs.classList.toggle("otf-stacked", query.length > 20);
        box.setAttribute("aria-label", "An ARC-1D episode for " + p.label + ": three input and output example " +
          "pairs and a query input whose output must be predicted.");
        caption.innerHTML = mdInline(String(block.caption || "").replace(/\{(\w+)\}/g, function (_, key) {
          return key === "task" ? p.label : p[key] || "";
        }));
      }
      select.addEventListener("change", function () { show(Number(select.value)); });
      const first = Math.max(0, data.presets.findIndex(function (p) { return p.category === block.task; }));
      select.value = String(first);
      show(first);

      box.append(pairs, menu);
      figure.append(box, caption);
      container.appendChild(figure);
    });
  };

  function build(container, data) {
    // One entry per hypernetwork, with task ID on the left.
    const models = data.models.map(function (m, k) {
      return { m: OnTheFly.create(m), usesTaskId: m.uses_task_id, map: m.map, k: k,
               name: m.uses_task_id ? "With task ID" : "Without task ID" };
    }).sort(function (a, b) { return b.usesTaskId - a.usesTaskId; });
    // support: the (editable) three examples.
    // given: index of the preset whose task ID the "with task ID" model is told. It follows the
    // chosen task until the visitor picks another label in step 2.
    const state = { task: null, support: null, examplesEdited: false, given: 0,
                    weights: null, query: 0, input: null, edited: false, paint: 1 };
    const copySupport = function (p) {
      return [p.support_inputs, p.support_outputs].map(function (rows) {
        return rows.map(function (r) { return r.slice(); });
      });
    };

    // Each step is a title, the box holding its interactive parts, then an optional caption that
    // says what the step showed and points to the next one.
    const step = function (title, caption) {
      const box = el("div", "otf-step");
      container.append(el("h3", "otf-step-title", title), box);
      if (caption) container.appendChild(el("p", "otf-caption", caption));
      return box;
    };
    const support = step("1. Create your task");
    const generateStep = step("2. Generate your model",
      "Each dot is a model generated for a held-out example, and models of the same task cluster " +
      "together. The star is yours: run it below.");
    const runStep = step("3. Run on new inputs");
    const closing = el("p", "otf-caption otf-closing");
    closing.append(
      el("strong", null, "Now play with it!"),
      " Create a new task (1) and watch where the stars move (2). Try a different input (3). " +
      "What happens? Give the model with a task ID the wrong label and it follows the " +
      "label, not the examples: ",
      el("strong", null, "it cannot generalise beyond its labels."));
    container.appendChild(closing);

    // The demo builds up as the visitor goes: step 1 starts with the task buttons alone, and the
    // examples with their editing tools appear once a task is picked.
    const tabs = presets("Pick a task:", "Task");
    const examples = el("div", "otf-examples");
    support.append(tabs, examples);
    const taskButtons = data.presets.map(function (p, i) {
      return tabs.appendChild(preset(p.label, function () { selectTask(i); }));
    });

    // --- Step 1: the three examples --------------------------------------------
    // Every cell is editable; each edit regenerates both models (if generated already).
    function renderSupport() {
      examples.replaceChildren();
      for (let e = 0; e < 3; e++) {
        const pair = el("div", "otf-pair");
        [0, 1].forEach(function (side) {
          const seq = state.support[side][e];
          pair.appendChild(labelled(side ? "y" : "x", row(seq, {
            onCell: function (i) {
              const orig = (side ? state.task.support_outputs : state.task.support_inputs)[e][i];
              seq[i] = paintCell(seq[i], orig, state.paint);
              state.examplesEdited = true;
              renderSupport();
              if (state.weights) generate(); else renderRun();
            },
          }), e + 1));
        });
        examples.appendChild(pair);
      }
      examples.appendChild(tools(state, "Customise your task: pick a colour, then click cells.",
        function () { renderSupport(); renderRun(); }, "Reset examples", state.examplesEdited,
        function () {
          state.support = copySupport(state.task);
          state.examplesEdited = false;
          renderSupport();
          if (state.weights) generate(); else renderRun();
        }));
    }

    // --- Step 2: both hypernetworks write a model --------------------------------
    // Only the button shows (disabled until a task is picked). Generating reveals the two maps
    // and their legend, and the stars follow a moment later.
    const genButton = el("button", "btn otf-primary", "Generate models");
    genButton.type = "button";
    genButton.disabled = true;
    const columns = el("div", "otf-columns");
    columns.hidden = true;
    let starTimer = null;
    // What each hypernetwork is given, under its name. The one with a task ID lets the visitor
    // choose which label it is told, so a wrong label can be tried against the same examples.
    let givenSelect = null;
    const panels = models.map(function (model) {
      const col = el("div", "otf-column");
      const given = el("p", "otf-hint otf-given");
      if (model.usesTaskId) {
        const label = el("label", null, "Examples and task ID");
        givenSelect = el("select", "otf-select");
        data.presets.forEach(function (p, i) {
          const option = el("option", null, p.label);
          option.value = String(i);
          givenSelect.appendChild(option);
        });
        givenSelect.addEventListener("change", function () {
          state.given = Number(givenSelect.value);
          if (state.weights) generate();
        });
        label.appendChild(givenSelect);
        given.appendChild(label);
      } else {
        given.textContent = "Examples only";
      }
      const mapCanvas = el("canvas", "otf-map");
      mapCanvas.setAttribute("role", "img");
      mapCanvas.setAttribute("aria-label", model.name + ": t-SNE map of the task vectors of " +
        model.map.xy.length + " models generated for held-out episodes, coloured by task; the new model is the star.");
      const tip = el("span", "otf-tip");
      tip.hidden = true;
      const frame = el("div", "otf-map-frame");
      frame.append(mapCanvas, tip);
      const nearest = el("p", "otf-hint otf-nearest");
      col.append(el("h4", "otf-model-name", model.name), given, frame, nearest);
      columns.appendChild(col);
      return { map: taskMap(mapCanvas, tip, model.map, data.categories), nearest: nearest };
    });
    const key = legend(data.categories, panels.map(function (p) { return p.map; }));
    key.hidden = true;
    generateStep.append(genButton, columns, key);
    function generate() {
      clearTimeout(starTimer);
      const zs = models.map(function (model) {
        return model.m.encode(state.support[0], state.support[1], data.presets[state.given].task_index);
      });
      state.weights = models.map(function (model, k) { return model.m.decode(zs[k]); });
      renderRun();
      const placeStars = function () {
        panels.forEach(function (panel, k) {
          panel.nearest.textContent = "Nearest task: " + data.categories[panel.map.place(zs[k])].label;
        });
      };
      if (!columns.hidden) return placeStars();
      columns.hidden = key.hidden = false;
      panels.forEach(function (panel) { panel.map.clear(); });  // draw the maps now that they have a size
      starTimer = setTimeout(placeStars, 600);
    }
    genButton.addEventListener("click", generate);

    // --- Step 3: run both generated models on the same new input -----------------
    function renderRun() {
      const p = state.task;
      runStep.replaceChildren();
      if (!p) return runStep.appendChild(el("p", "otf-hint otf-note", "Pick a task in step 1 first."));

      runStep.appendChild(labelled("x'", row(state.input, {
        onCell: function (i) {
          state.input[i] = paintCell(state.input[i], state.task.queries[state.query].input[i], state.paint);
          state.edited = true;
          renderRun();
        },
      })));

      // The reference answer belongs to the preset task and input: once either the examples or
      // the input are repainted it no longer applies, so it is hidden.
      const expected = state.edited || state.examplesEdited ? null : p.queries[state.query].output;
      if (expected) runStep.appendChild(labelled("y'", row(expected)));

      models.forEach(function (model, k) {
        runStep.appendChild(el("h4", "otf-model-name", model.name));
        if (!state.weights) {
          runStep.appendChild(labelled("\\hat{y}'", row(state.input.map(function () { return null; }))));
          return;
        }
        const prediction = model.m.predict(state.weights[k], state.input);
        const wrong = expected && prediction.map(function (v, i) { return v !== expected[i]; });
        runStep.appendChild(labelled("\\hat{y}'", row(prediction, { wrong: wrong }), null,
          expected && verdict(wrong.filter(Boolean).length, prediction.length)));
      });
      if (!state.weights) runStep.appendChild(el("p", "otf-hint otf-note", "Generate your model above to see its predictions."));

      runStep.appendChild(tools(state, "Repaint: pick a colour, then click cells.",
        function () { renderRun(); renderSupport(); }, "Reset input", state.edited,
        function () { setQuery(state.query); }));

      const picks = presets("Input:", "New input");
      p.queries.forEach(function (q, i) {
        const b = picks.appendChild(preset(String(i + 1), function () { setQuery(i); }));
        b.setAttribute("aria-label", "Input " + (i + 1));
        b.setAttribute("aria-pressed", String(!state.edited && state.query === i));
      });
      runStep.appendChild(picks);
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
      state.given = i;
      if (givenSelect) givenSelect.value = String(i);
      taskButtons.forEach(function (b, j) { b.setAttribute("aria-pressed", String(i === j)); });
      // Step 2 goes back to its button alone.
      clearTimeout(starTimer);
      genButton.disabled = false;
      columns.hidden = key.hidden = true;
      panels.forEach(function (panel) {
        panel.map.clear();
        panel.nearest.textContent = "";
      });
      renderSupport();
      setQuery(0);
    }

    renderRun();  // no task yet: step 3 shows its hint
  }
})();
