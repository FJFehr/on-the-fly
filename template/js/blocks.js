/**
 * ============================================================================
 * BLOCKS — the dispatcher that turns one project.yaml sections[].blocks[]
 * entry into DOM. This, together with render.js building <section> elements
 * from sections[], is what closes the "adding a new section requires an
 * index.html edit" gap (docs/01-principles.md #6): the engine renders
 * whatever the config describes, generically. See tasks/04-engine-js-blocks.md.
 *
 * Every renderer has the signature (container, blockConfig) -> void |
 * Promise<void>. renderBlock() is the single entry point render.js calls.
 * ============================================================================
 */

(function () {
  "use strict";

  function fetchText(path) {
    return fetch(path).then(function (res) {
      if (!res.ok) throw new Error(path + " responded " + res.status);
      return res.text();
    });
  }

  function fetchYaml(path) {
    return fetchText(path).then(parseYamlLite);
  }

  function loadFailure(container, path, err) {
    console.error("Failed to load " + path + ":", err);
    container.textContent =
      "Content failed to load (" + path + "). If you're previewing locally, " +
      "serve this folder over http:// (not file://).";
  }

  // A figure whose `src` is an animation that should be watched once, not looped: it plays
  // for `play_ms`, fades out, and the `still` image fades in and stays. Changing the theme
  // replays it in the new theme. Visitors who ask for reduced motion only get the still, and
  // so does anyone whose connection has not delivered the animation within WAIT_MS: content
  // first, rather than an empty box or an animation that starts while they are reading.
  const WAIT_MS = 1500;
  function playOnceFigure(figure, block) {
    const stage = document.createElement("div");
    stage.className = "figure-stage";
    stage.setAttribute("role", "img");
    stage.setAttribute("aria-label", block.alt || "");
    const still = document.createElement("img");
    const anim = document.createElement("img");
    still.className = "figure-still";
    anim.className = "figure-anim";
    still.alt = anim.alt = "";
    stage.append(still, anim);
    figure.appendChild(stage);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const themed = function (light, dark) {
      return dark && document.documentElement.getAttribute("data-theme") === "dark" ? dark : light;
    };
    const blobs = {};   // animation URL -> Promise<Blob>, so each file is downloaded once
    let run = 0, timer = null, objectUrl = null;

    function setState(state) {
      stage.classList.toggle("is-waiting", state === "waiting");
      stage.classList.toggle("is-playing", state === "playing");
    }

    function play() {
      const id = ++run;   // a later play() (another theme change) cancels this one
      clearTimeout(timer);
      still.src = themed(block.still, block.still_dark);
      if (reducedMotion.matches) return setState("resting");
      setState("waiting");
      timer = setTimeout(function () { if (id === run) { run += 1; setState("resting"); } }, WAIT_MS);
      const url = themed(block.src, block.src_dark);
      blobs[url] = blobs[url] || fetch(url).then(function (res) {
        if (!res.ok) throw new Error(url + " responded " + res.status);
        return res.blob();
      });
      blobs[url].then(function (blob) {
        if (id !== run) return;
        // A new object URL is a new image to the browser, so its animation starts from the
        // first frame. Re-using the file's own URL would resume or skip the replay.
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = URL.createObjectURL(blob);
        anim.onload = function () {
          if (id !== run) return;
          clearTimeout(timer);
          setState("playing");
          timer = setTimeout(function () { if (id === run) setState("resting"); }, Number(block.play_ms) || 0);
        };
        anim.src = objectUrl;
      }).catch(function (err) {
        console.error("Failed to load " + url + ":", err);
        if (id === run) { clearTimeout(timer); setState("resting"); }
      });
    }

    new MutationObserver(play).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    play();
  }

  const renderers = {
    markdown: function (container, block) {
      container.classList.add("block-markdown");
      return fetchText(block.source)
        .then(function (text) { container.innerHTML = mdBlock(text); })
        .catch(function (err) { loadFailure(container, block.source, err); });
    },

    figure: function (container, block) {
      // Optional title above the figure, styled like a section heading
      // (legal-reward-bench's pull figure has its own h2).
      if (block.title) {
        const h2 = document.createElement("h2");
        h2.className = "block-title";
        h2.textContent = block.title;
        container.appendChild(h2);
      }
      const figure = document.createElement("figure");
      if (block.id) figure.id = block.id;  // optional: lets prose link to this figure with (#id)
      if (block.position === "left" || block.position === "right") {
        figure.classList.add("fig-" + block.position);
      }
      // Optional width (any CSS length, e.g. "60%") for small plots that
      // would otherwise stretch to the full prose width.
      if (block.width) figure.style.maxWidth = block.width;
      // Optional space above and below (any CSS length); the default is 24px.
      if (block.margin) figure.style.marginBlock = block.margin;
      if (block.still) {
        // Optional `still` (+ `still_dark`, `play_ms`): `src` is an animation that plays
        // once and then gives way to the still.
        playOnceFigure(figure, block);
      } else {
        const img = document.createElement("img");
        img.src = block.src;
        img.alt = block.alt || "";
        figure.appendChild(img);
        // Optional dark-theme variant: render both, CSS shows the one that
        // matches the active [data-theme] (tasks/11, gap 1).
        if (block.src_dark) {
          img.classList.add("figure-light");
          const imgDark = document.createElement("img");
          imgDark.src = block.src_dark;
          imgDark.alt = block.alt || "";
          imgDark.className = "figure-dark";
          figure.appendChild(imgDark);
        }
      }
      if (block.caption) {
        const figcaption = document.createElement("figcaption");
        figcaption.innerHTML = mdInline(block.caption);
        figure.appendChild(figcaption);
      }
      container.appendChild(figure);
    },

    // Figures side by side: `figures` is a list of figure blocks (same keys
    // as `figure`). Stacks on narrow screens.
    figure_row: function (container, block) {
      const row = document.createElement("div");
      row.className = "figure-row";
      (block.figures || []).forEach(function (fig) { renderers.figure(row, fig); });
      container.appendChild(row);
    },

    takeaways: function (container, block) {
      return fetchYaml(block.source)
        .then(function (items) {
          // Optional heading above the cards, same style as a figure title.
          if (block.title) {
            const h2 = document.createElement("h2");
            h2.className = "block-title";
            h2.textContent = block.title;
            container.appendChild(h2);
          }
          const grid = document.createElement("div");
          grid.className = "takeaways-grid";
          (items || []).forEach(function (item) {
            const card = item.anchor ? document.createElement("a") : document.createElement("div");
            card.className = "takeaway";
            if (item.anchor) card.href = item.anchor;
            card.innerHTML =
              "<strong>" + mdInline(item.title || "") + "</strong> " + mdInline(item.body || "");
            grid.appendChild(card);
          });
          container.appendChild(grid);
        })
        .catch(function (err) { loadFailure(container, block.source, err); });
    },

    table: function (container, block) {
      const wrap = document.createElement("div");
      wrap.className = "table-scroll";
      const table = document.createElement("table");
      wrap.appendChild(table);
      container.appendChild(wrap);
      return fetchText(block.source)
        .then(function (text) {
          renderMarkdownTable(table, text);
          // Optional caption, inline Markdown like figure captions.
          if (block.caption) {
            const caption = document.createElement("caption");
            caption.innerHTML = mdInline(block.caption);
            table.insertBefore(caption, table.firstChild);
          }
        })
        .catch(function (err) { loadFailure(container, block.source, err); });
    },

    results_table: function (container, block) {
      const wrap = document.createElement("div");
      wrap.className = "table-scroll";
      const table = document.createElement("table");
      wrap.appendChild(table);
      container.appendChild(wrap);
      return fetchYaml(block.source)
        .then(function (data) { renderResultsTable(table, data); })
        .catch(function (err) { loadFailure(container, block.source, err); });
    },

    callout: function (container, block) {
      const div = document.createElement("div");
      div.className = "callout callout-" + (block.style || "tldr");
      container.appendChild(div);
      return fetchText(block.source)
        .then(function (text) { div.innerHTML = mdBlock(text); })
        .catch(function (err) { loadFailure(container, block.source, err); });
    },

    citation: function (container, block) {
      const wrap = document.createElement("div");
      wrap.className = "citation-block";
      // Optional note above the BibTeX (inline Markdown), e.g. where the
      // paper was presented -- legal-reward-bench's bibtex-note slot.
      if (block.note) {
        const note = document.createElement("p");
        note.className = "bibtex-note";
        note.innerHTML = mdInline(block.note);
        wrap.appendChild(note);
      }
      const pre = document.createElement("pre");
      pre.id = "bibtex-block";
      const btn = document.createElement("button");
      btn.id = "copy-bibtex-btn";
      btn.type = "button";
      btn.textContent = "Copy BibTeX";
      wrap.appendChild(pre);
      wrap.appendChild(btn);
      container.appendChild(wrap);
      return fetchText(block.source)
        .then(function (text) {
          if (typeof window.renderBibtex === "function") window.renderBibtex(text);
        })
        .catch(function (err) { loadFailure(container, block.source, err); });
    },

    // Page-specific interactive content (e.g. a live demo): loads an optional
    // stylesheet and the listed scripts in order, then calls the global
    // function named by `render` with (container, block).
    custom: function (container, block) {
      if (block.stylesheet) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = block.stylesheet;
        document.head.appendChild(link);
      }
      const loadScript = function (src) {
        return new Promise(function (resolve, reject) {
          const script = document.createElement("script");
          script.src = src;
          script.onload = resolve;
          script.onerror = function () { reject(new Error(src + " failed to load")); };
          document.head.appendChild(script);
        });
      };
      return (block.scripts || []).reduce(function (chain, src) {
        return chain.then(function () { return loadScript(src); });
      }, Promise.resolve())
        .then(function () { return window[block.render](container, block); })
        .catch(function (err) { loadFailure(container, block.render, err); });
    },
  };

  function renderBlock(container, block) {
    const renderer = renderers[block.type];
    if (!renderer) {
      console.warn('blocks.js: block type "' + block.type + '" isn\'t implemented yet.');
      const div = document.createElement("div");
      div.className = "block-unsupported";
      div.textContent = 'Block type "' + block.type + '" isn\'t implemented yet.';
      container.appendChild(div);
      return;
    }
    return renderer(container, block);
  }

  // Exposed for render.js.
  window.renderBlock = renderBlock;
})();
