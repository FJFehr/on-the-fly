# The in-browser demo: how it works

This folder holds the live demo on the project page (section **"Try It in Your
Browser"**). The page runs two trained hypernetworks from the paper live in the
visitor's browser. There is no server, no GPU and no library.

This file explains what the demo does, how we know it is correct, and what to check
before we show it to the world.

---

## 1. What the visitor sees

1. **Pick a task**: any of the 14 trained tasks, named as in the paper's figures (Denoise,
   Denoise MC, Fill, Flip, …). The page shows its three example pairs, x1→y1, x2→y2 and x3→y3.
2. **Generate.** Two hypernetworks read the same three examples:
   - **Without task ID:** it sees the examples only.
   - **With task ID:** it also gets the task's label, for example "Flip".

   Each one writes **all 1,204 weights** of a new small Transformer. "With task ID" is on
   the left, "Without task ID" on the right. For each, the page shows:
   - the 4-number **task vector z**,
   - where the new model lands, as a star, on a **map of 1,400 other generated models**
     (section 4).
3. **Run.** Both generated models predict the output for a new input x′. They run on
   their own: the examples and the hypernetwork are no longer used. The visitor can:
   - pick one of 4 unseen inputs, which have known answers and show ✓/✗, or
   - paint their own input cell by cell. Then there is no reference answer.

The generation pipeline for one task:

```
3 example pairs ──► encoder ──► attention pool ──► z (4 numbers) ──► decoder MLP ──► 1,204 weights
 (+ task ID, for the "with" model: a fixed vector added to z)       4 → 8 → 1,204
```

Then, for any number of new inputs:

```
new input x′ ──► small Transformer running on the 1,204 generated weights ──► prediction ŷ′
```

---

## 2. The two models

Both come from experiment 2 in `on-the-fly-models`
(`outputs/02_hypernetwork_multitask_refactor/`). They have the same architecture and
were trained on the same 14 tasks.

|  | Without task ID | With task ID |
|---|---|---|
| Checkpoint | `hyper_multitask_dim4_notd_seed4` | `hyper_multitask_dim4_frozentd_seed4` |
| Trainable parameters | 10,156 | 10,156 (+72 frozen, for the task ID) |
| Generated model | 1,204 weights, 3 layers, width 4 | same |
| Test exact match, this seed | 67.1% | 95.5% |

**Why seed 4:** it is the best of the 5 seeds without task ID (the others score
53–58%). So the demo shows the no-task-ID model a little better than the paper's
5-seed mean. If we want the demo to match the paper's averages, use a median seed.

---

## 3. How it runs in the browser

| File | What it is |
|---|---|
| `hypernet.js` | The forward pass in plain JavaScript, about 150 lines. It ports `models/transformer.py` (RoPE, Canon layers, LayerNorm, attention, GELU MLP) and `models/hypernetwork.py` (pooling, decoder, weight slicing). |
| `weights.json` | Both models' weights, the preset episodes and the task maps (376 KB). |
| `demo.js`, `demo.css` | The interface. |
| `export_weights.py` | Builds `weights.json` from the checkpoints. |
| `check.mjs` | Checks the JS against PyTorch (section 5). |

The page loads the demo through a small generic `custom` block type, which was
added to `template/js/blocks.js`. See the `demo` section in `project.yaml`.

**Speed:** generating the weights takes about 5–10 ms. One prediction takes about 1 ms.

### One detail that matters: padding to 35

The model's attention has **no padding mask**. In training, each batch mixed many
tasks and was padded to its longest sequence. For the 14 tasks that was always
**length 35**, because 5% of tasks have length 35 and a batch holds 512 tasks. So the
model learned to expect that padding. The demo therefore pads every sequence to 35,
exactly as in training.

Without this padding, test exact match falls from 65% to 35%. Padding to 40 or 48
is also worse. This sensitivity is a property of the trained model, not of the
demo, and it may be worth a sentence in the paper's limitations.

---

## 4. The task map (the t-SNE plot)

### What it shows

Each dot is one model generated for one held-out test episode: 1,400 dots, which are
14 tasks × 100 episodes. The dot's position comes from a **t-SNE of its task vector z**.
That is the 4 numbers the hypernetwork decodes into weights.

The map copies the paper's figure (`visualisation/paper/plot_embedding_clusters.py`):
- t-SNE settings: perplexity 30, PCA initialisation, `random_state=0`. Each model gets its
  own map.
- Task labels and colours come from that script's `build_display_categories`, so they
  match the paper exactly. Dots are larger than in the paper and more see-through (alpha 0.4); labels use the serif font.
- Light grid, left and bottom axes only, and one shared legend below both maps.

Hover over a dot, or over a task name in the legend, to name and highlight that task. The
other tasks turn flat grey. They cannot just fade: each blob is about 20 overlapping dots,
so faded dots stack back to full colour. The new model is a large solid star.

### How a new model is placed

t-SNE cannot add a point to a finished map. So the demo computes the new model's z,
finds its **10 nearest neighbours in z** among the 1,400, and places it at their
distance-weighted average position. For the preset tasks the episode is itself one of
the 1,400, so it lands exactly on its own dot.

**Caveat:** for inputs far from anything in the test set, this placement is an
approximation, not a true t-SNE position. That will matter once visitors can edit the
examples.

### Why the map is made of tight little blobs

The test set has **70 distinct puzzles**, 5 per task, and **20 colour variants of
each**. The hypernetwork gives colour variants nearly the same z: 97–99% of each dot's
5 nearest neighbours are colour variants of the same puzzle. So each blob is one
puzzle in 20 colourings. That is a nice result in itself: z captures the rule, not
the colours.

### ⚠️ Check before publishing: the paper's figure caption

The paper's t-SNE figure (`assets/figures/weight-space-tsne.png`) says its caption is
a *"t-SNE of generated target-model parameters"*. But the code that made it
(`HypernetworkLightning.collect_embedding_records_from_dataloader`, which saves
`hypernetwork.last_task_representation`) projects the **task vector z**, not the
1,204 weights. The demo map does the same, so its wording says "task vector".

Is z a fair stand-in for the weights? Mostly yes. Here is what I measured on the 1,400
test episodes:

| | Without task ID | With task ID |
|---|---|---|
| Rank of the 1,400 × 1,204 weight matrix | **8** | **8** |
| Overlap of each point's 10 nearest neighbours, z vs weights | 84% | 79% |
| Nearest neighbours from the same task, in z / in weights | 98% / 99% | 100% / 100% |
| Linear probe for task, on z / on weights (5-fold) | 52% / 53% | 100% / 100% |

The rank is 8 because the decoder is 4 → 8 → 1,204, with no bias. **Every generated
model lies in the same 8-dimensional slice of the 1,204-dimensional weight space**,
and on a 4-dimensional surface inside it. So "weight space" and "z space" carry the
same task structure here.

**Suggested fix:** change the caption to "t-SNE of the task representations from
which the target parameters are generated", or recompute the figure on the weights.
Both would be accurate.

**Linear probe numbers:** the paper reports 60.9% (no task ID) and 100% (task ID),
on the validation split. My 52% above is on the test split with a different
classifier setup, so don't compare the two directly. The checkpoint's own
validation probe for seed 4 is 64.7% / 96.7%.

### Edited examples

Visitors can paint any cell of the three examples. Every edit regenerates both models,
moves both stars and reruns step 3. The line under each map names the trained task
nearest to the star.

---

## 5. How we know the JS is correct

`export_weights.py --reference` saves PyTorch's results for all 1,400 test episodes,
for both models. `check.mjs` reruns every episode in JavaScript and compares:

```
without task ID: predictions identical 1400/1400, max z/weight diff 1.67e-5
with task ID:    predictions identical 1400/1400, max z/weight diff 1.41e-5
```

The small differences are float32 (PyTorch) vs float64 (JS) rounding. They never
change a prediction.

---

## 6. Honesty notes on what the demo shows

- **Preset examples are chosen.** For each task, the three examples are the set whose
  generated models solve the most queries in that task. Sets that both models solve
  on the paired query come first. The page says so.
- **The other inputs are random.** Inputs 2–4 are a fixed random draw from the same
  task. They are not filtered to ones the models get right.
- **The real accuracy is printed** under every task, for example Move 1 step: 23%
  without task ID vs 100% with it.
- **Differences are rare on the presets.** On 12 of the 14 tasks both models solve all
  4 preset inputs. On Mirror both fail input 3. On Move Dynamic, the model without task
  ID solves only input 1 and the model with task ID solves inputs 1 and 2. So the gap
  mostly shows when visitors paint their own inputs.
- **Possible mismatch:** the page and code README say the generated model has 1,204
  parameters, but the paper text says "1.4K" (`content/generation.md`). Check which
  model the paper means.

---

## 7. Rebuild the weights

From the `on-the-fly-models` repo:

```bash
O=outputs/02_hypernetwork_multitask_refactor
uv run python ../on-the-fly/demo/export_weights.py \
    $O/hyper_multitask_dim4_notd_seed4/best_model.ckpt \
    $O/hyper_multitask_dim4_frozentd_seed4/best_model.ckpt \
    --reference /tmp/reference.json
node ../on-the-fly/demo/check.mjs /tmp/reference.json
```

This takes about 30 s. The checkpoints and `data/arc_1d_looped_augmented` are needed
locally.

---

## 8. Possible next steps

- **Editable examples.** Let visitors change the three examples. Then the z values,
  the weights and the dot on the map all move live, which is the truly "dynamic" map.
- **Median seed** instead of the best seed, to match the paper's averages (section 2).
