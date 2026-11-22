# Narrative outline: project page and blog post

One storyline, two depths. The project page is the highlights reel (about 5 minutes,
scannable). The blog post tells the same story with more teaching and a critical view
(about 4k words). Each **beat** below is one claim with its evidence. Write a beat once
here, then lift it into either medium.

Prose is skeletal on purpose. Iterate the wording in `content/*.md` (page) and in
`../on-the-fly-blogpost/_posts/` (blog).

---

## The three key messages

These are the only things a reader must leave with. Everything else supports them.

| # | Message (working wording) | Headline evidence |
|---|---|---|
| **K1** | At a fixed parameter budget, a model trained on one function reaches what a model trained on many cannot. This is about capacity under standard training (backprop, current optimisers), not a lower bound on how small a function could be. | Individual models: 98.9% at 2.4K params. Joint model, same size, with task ID: 74.0%. |
| **K2** | A single shared hypernetwork can write these specialists from three examples. This is the new part. | A 10K hypernetwork generates all 1,204 weights and largely recovers specialist accuracy. Its latent z is organised by task. |
| **K3** | Inferring the task from examples, not from a task ID, generalises further. This points at a way round ARC-style reliance on explicit task IDs (as in HRM and TRM). It is a direction worth scaling, not a scaling claim. | Unseen transformations: 9.1% vs 0.3% exact match, +13.4 token accuracy. The task ID wins in-distribution (97.0 vs 64.7). |

One-line thesis: *a shared hypernetwork can turn a few examples into a small,
standalone, reusable model, without being told which task it is.*

Framing guard: no "cheap" or "expensive" language. Talk about capacity at a given
parameter size, and what is achievable simply with standard training.

---

## Beats

| Beat | Claim | Evidence | Page | Blog | Dynamic candidate |
|---|---|---|---|---|---|
| B0 Hook | Examples in, a working model out. | Hero GIF; live demo | Hero + Demo | Opening widget | Exists (live JS demo; Plotly version in blog `widgets/`) |
| B1 Problem | General models adapt from context. Specialists are small but need training. | Framing only | TL;DR, 1 sentence | Intro, 2 to 3 paragraphs + related work | None |
| B2 Testbed | ARC-1D: 3 support pairs define a rule, predict the query. | Episode figure | Inline in "How it works" | Own short section | Demo task picker already shows episodes |
| B3 = K1 | At a given parameter size, specialists reach accuracy that joint models do not, under standard training. | Capacity cliff figure | Results 1 | Experiment 1 | Slider over parameter count, individual vs joint |
| B4 Method | Encoder reads examples into z. Decoder writes every weight. The model then runs alone. | GIF, 3-line description | "How it works" | Method section, with equations | Demo steps 1 to 3 |
| B5 = K2a | Generated models recover specialist accuracy. | Per-task bars | Results 2 | Experiment 2 | Toggle with/without task ID per task |
| B6 = K2b | The latent z is organised by task; related tasks sit close. | t-SNE of z (100% / 60.9% probe) | Results 2 | Experiment 2 | Demo map already does this |
| B7 Insight (blog) | All generated models lie in an 8-dim slice of weight space. z captures the rule, not the colours. | `demo/README.md` section 4 measurements | Skip | "What did the hypernetwork learn?" | Colour-swap in the demo moves the star very little |
| B8 = K3a | Generate once, execute many. | LOO figure | Results 3, rung 1 | Experiment 3 | None needed |
| B9 = K3b | Partial compositional generalisation. | Fill ∘ Mirror example; table | Results 3, rung 2 | Experiment 3 | Pick a composition in the demo (later) |
| B10 = K3c | Unseen transformations; the task ID trade-off. Link to ARC: tiny ARC models rely on task IDs and heavy augmentation; inferring the task from examples is one way round the task-ID part. | Table | Results 3, rung 3 | Experiment 3 | Task ID on/off toggle on the table |
| B11 Did not work | Hypothesis: parameter sharing in the hypernetwork would need less training data. Result: no gain over individual models, at least at this scale and with this training. Secondary: exact match on compositions stays about 1%; tiny models only. | Appendix "Data Efficiency" | 1 to 2 lines under Conclusion | Full section (the track asks for "ideas that did not work out") | Data-efficiency curve |
| B12 Outlook | From task identification to model construction; local specialists; ARC-AGI and LoRA-scale generation. | Discussion | Conclusion, 3 bullets | Closing section | None |
| B13 Practical findings | (a) Canon layers improve exact match in every setting, most at low capacity. A short 1D convolution mixes neighbouring tokens everywhere, the right inductive bias for small 1D sequence tasks. Canon was proposed for multi-hop reasoning in larger language models; this is a good use case at tiny scale. (b) Muon matches or beats AdamW in every direct-training setting. Caveat: the AdamW learning rate was not tuned there; in the tuned hypernetwork search Muon has the best test exact match (66.7 ± 11.0 vs 60.0 ± 0.9) but AdamW the lower validation loss. | Appendix ablations (Canon, optimiser, hyperparameter search) | One line in "How it works" (optional) | Own section | Canon on/off toggle on the capacity plot |

---

## Project page order (target for today)

1. **Hero**: title, venue, buttons.
2. **TL;DR** (B1 + thesis, 2 to 3 sentences) and **hero GIF** (B0, B4).
3. **Key takeaways**: three cards, K1 to K3, each linking to its results block.
4. **How it works** (B4 + B2): 3 lines plus the ARC-1D episode figure.
5. **Try it in your browser** (B0): the demo. Placed early because it is the hook.
6. **Results**, one block per message:
   - 6a. K1, specialisation needs less capacity (B3).
   - 6b. K2, generating specialists (B5, B6).
   - 6c. K3, how far they generalise: a ladder of reuse, then composition, then unseen (B8 to B10).
7. **Conclusion and outlook** (B12), plus a short limitations note (B11).
8. **Cite**.

Changes from the current `project.yaml`: merge Method and Data into "How it works";
move Demo up, before Results; group three results blocks under K1 to K3; rename
"Going Beyond" to "Conclusion" and shorten it.

## Blog post order (ICLR 2027 Blogposts, due 1 Dec 2026)

1. Opening widget and question (B0, B1): can examples become weights?
2. Background: function induction, hypernetworks, ARC-1D, task IDs in tiny ARC models (B1, B2).
3. Experiment 1: the capacity cost of sharing (B3).
4. Experiment 2: generating specialists (B4 to B6).
5. What did the hypernetwork learn? (B7) The bottleneck and colour invariance. Blog-only, the most "new insight" part.
6. Experiment 3: the generalisation ladder and the task ID trade-off (B8 to B10).
7. Two practical findings: Canon layers and Muon (B13).
8. What did not work, and open questions (B11).
9. Outlook (B12).

Blog constraints that affect transfer: anonymous (no names, links to the page, arXiv
or code); figures redrawn, not copied verbatim; interactivity as self-contained HTML
in iframes (Plotly), no custom JS. Keep figure data and scripts reusable so each
figure can be redrawn in both styles.
