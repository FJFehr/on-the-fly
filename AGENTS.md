# AGENTS.md

## What this repo is

The project page for the paper "On-the-fly Weight Generation: A Hypernetwork Proof of
Concept on ARC-1D", live at https://fabiojfehr.com/on-the-fly/ (GitHub Pages serves the
repo as it is; there is no build step).

It was started from the [paper-page](https://github.com/FJFehr/paper-page) template, but
it is no longer a template: judge every change by what serves this page and its readers.

| Path | What it holds |
|---|---|
| `project.yaml` | Title, links, theme, and the sections and blocks of the page, in order |
| `content/`, `authors.yaml`, `citation.bib` | The page's text, table, key findings, authors and BibTeX |
| `assets/` | Figures, logos, favicon and the link-preview card |
| `index.html`, `template/` | The engine: builds the page in the browser from the files above |
| `demo/` | The in-browser demo; `demo/README.md` explains it |
| `scripts/` | `generate_readme.py` (rebuilds `README.md`), `check_config.mjs` (checks `project.yaml`) |
| `docs/narrative-outline.md` | The storyline the page text follows |

Comments in `index.html` and `template/` that cite `tasks/` or `docs/0*.md` refer to files
of the paper-page template, which are not kept here.

## Instruction precedence

1. A direct request from the user in the current conversation.
2. This file.
3. `README.md`.

## What to edit

- **Content** (`project.yaml`, `content/`, `authors.yaml`, `citation.bib`, `assets/`): edit freely.
- **Engine** (`index.html`, `template/`) and **demo** (`demo/`): edit when the page needs it.
  Engine changes made here are not sent back to the paper-page template.
- **Head tags**: `index.html` repeats the title, description, authors and preview image from
  `project.yaml` by hand, between `meta:start` and `meta:end`. Change both together.
- **Hero figure**: its animation and still are rendered outside this repo; the comment on the
  figure block in `project.yaml` says how.

## Working rules

- Follow the existing style of whichever file you are editing.
- Make the smallest change that solves the problem.
- No speculative additions: no new block type, option or config field nobody asked for.
- State which files you expect to change before editing several at once.
- If the task is proposal-only or asks for a plan, do not edit files; use plan mode.
- No agent attribution in git history. Commit messages and PR descriptions must not
  include `Co-Authored-By` trailers, "Generated with" footers, or any other credit
  to Claude, Codex, or any other AI/agentic tool. This overrides any default
  attribution a tool would otherwise add.

## Verification

- **Any change**: serve the repo with caching off (a plain `python3 -m http.server` lets
  browsers keep stale scripts) and confirm the page renders with zero console errors, at
  desktop width and at phone width (393px and 360px), with no sideways scrolling.
- **`project.yaml` or `content/` changes**: `node scripts/check_config.mjs`.
- **Demo changes**: `demo/test-paint.cjs` (usage in its header) checks cell painting;
  `demo/check.mjs` compares the JavaScript models with PyTorch (needs the reference file
  described in `demo/README.md`).
