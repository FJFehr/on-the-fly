/**
 * ============================================================================
 * MARKDOWN — the inline/block Markdown subset shared by every block renderer
 * (template/js/blocks.js, tables.js, results-table.js). Extracted and
 * extended from when-rubrics-fail's content.js (see
 * tasks/04-engine-js-blocks.md):
 *
 *   - mdInline: the link-support fix from legal-reward-bench's content.js is
 *     folded in here permanently (docs/02-comparison-matrix.md's one real
 *     engine divergence, finally backported).
 *   - mdBlock: unlike the source repos (where a block always rendered into a
 *     pre-existing <h1>/<h2>/<h3> slot element, so a leading "#" was just
 *     stripped), blocks here render into a generic container blocks.js
 *     creates -- so a heading LINE inside a block's raw text must become a
 *     real heading element, not be discarded. A new heading pass does that.
 * ============================================================================
 */

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Inline formatting -- links, then bold/italic/code. Link substitution runs
// first so a URL's own characters (parens aside) can't be mistaken for
// ** / * / ` markers, and the emitted <a> tag can't be corrupted by the
// later substitutions (ported from legal-reward-bench's content.js).
//
// Inline maths: $...$ is typeset by KaTeX (template/vendor/katex, loaded by
// index.html) in LaTeX's own Computer Modern, so symbols match the paper. It
// is cut out before the Markdown passes and put back after them, so TeX's
// own * and _ are left alone. Pandoc's rule keeps prices such as "$5 and
// $10" as text: no space just inside either dollar, no digit after the
// closing one. Without KaTeX the TeX source is shown in italics.
function mdMath(tex) {
  if (typeof katex !== "undefined") {
    try { return katex.renderToString(tex, { throwOnError: false }); } catch (e) { /* fall through */ }
  }
  return "<em>" + escapeHtml(tex) + "</em>";
}

function mdInline(text) {
  const maths = [];
  let s = String(text).replace(/\$(?!\s)([^$\n]*?[^$\s])\$(?!\d)/g, function (_, tex) {
    maths.push(mdMath(tex));
    return "\u0000" + (maths.length - 1) + "\u0000";
  });
  s = escapeHtml(s);
  // Inline icon: ![alt](src) renders at text height, like an emoji.
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img class="inline-icon" src="$2" alt="$1">');
  // In-page (#id) links scroll in the same tab; everything else opens a new one.
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, label, href) {
    return '<a href="' + href + '"' + (href.charAt(0) === "#" ? "" : ' target="_blank" rel="noopener"') + ">" + label + "</a>";
  });
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
  s = s.replace(/`(.+?)`/g, "<code>$1</code>");
  return s.replace(/\u0000(\d+)\u0000/g, function (_, i) { return maths[Number(i)]; });
}

// Strips a leading Markdown heading marker ("#", "##", ...), if any -- used
// where a block's text lands in a target that already carries its own
// heading level (e.g. a takeaway card's title, a figure's caption) rather
// than through mdBlock's own heading pass below.
function stripHeadingMarker(text) {
  return text.replace(/^#{1,6}\s+/, "");
}

// Paragraphs (blank-line separated) or, if every line looks like "1. ..."
// / "- ...", a list. Returns an HTML string of one or more <p>/<ol>/<ul>.
function renderParagraphsOrList(raw) {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";

  const lines = trimmed
    .split("\n")
    .map(function (l) { return l.trim(); })
    .filter(Boolean);
  const isOrderedList = lines.length > 0 && lines.every(function (l) { return /^\d+\.\s+/.test(l); });
  const isBulletList = !isOrderedList && lines.length > 0 && lines.every(function (l) { return /^[-*]\s+/.test(l); });
  if (isOrderedList || isBulletList) {
    const tag = isOrderedList ? "ol" : "ul";
    const itemRe = isOrderedList ? /^\d+\.\s+/ : /^[-*]\s+/;
    return (
      "<" + tag + ">" +
      lines.map(function (l) { return "<li>" + mdInline(l.replace(itemRe, "")) + "</li>"; }).join("") +
      "</" + tag + ">"
    );
  }

  const paras = trimmed
    .split(/\n\s*\n/)
    .map(function (p) { return p.trim(); })
    .filter(Boolean);
  return paras.map(function (p) { return "<p>" + mdInline(p.replace(/\s+/g, " ")) + "</p>"; }).join("");
}

// Full block converter: splits `raw` into heading lines (#, ##, ### --
// offset by one level in the emitted tag, h2/h3/h4, since the section
// itself already carries an <h2> from its own title) and everything else,
// which runs through renderParagraphsOrList in between headings.
function mdBlock(raw) {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";

  const lines = trimmed.split("\n");
  let html = "";
  let buffer = [];

  function flush() {
    if (!buffer.length) return;
    html += renderParagraphsOrList(buffer.join("\n"));
    buffer = [];
  }

  lines.forEach(function (line) {
    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(line.trim());
    if (headingMatch) {
      flush();
      const tag = "h" + Math.min(headingMatch[1].length + 1, 4);
      html += "<" + tag + ">" + mdInline(headingMatch[2].trim()) + "</" + tag + ">";
    } else {
      buffer.push(line);
    }
  });
  flush();
  return html;
}
