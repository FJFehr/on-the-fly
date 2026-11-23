Tiny models such as [HRM](https://arxiv.org/abs/2506.21734),
[TRM](https://arxiv.org/abs/2510.04871) and
[URM](https://arxiv.org/abs/2512.14693) have shown that small networks can
solve abstract reasoning problems in ARC-AGI. An
[analysis of HRM](https://arcprize.org/blog/hrm-analysis) finds that the
refinement loops are less valuable during inference than in training, and that
performance stems largely from fitting each evaluation puzzle with a learned
identifier, the `puzzle_id`. An alternative approach,
[CompressARC](https://arxiv.org/abs/2512.06104), needs no identifier, but
optimises a separate network from scratch at test time; its authors list a
hypernetwork mapping learned puzzle embeddings to weights as
[future work](https://iliao2345.github.io/blog_posts/arc_agi_without_pretraining/arc_agi_without_pretraining.html).
In both cases, solving a new task first requires gradient descent, but what
if a forward pass could replace this step?

[In-context learning](https://arxiv.org/abs/2005.14165) already does so, but
still requires a large general-purpose model and remains tied to its context.
We explore a hypernetwork that
infers the task from the examples and generates the weights of a compact model
that executes independently. Similarly,
[Text-to-LoRA](https://openreview.net/forum?id=zWskCdu3QA) generates adapters
from textual descriptions; but here our result is standalone, reusable and small
enough to run locally. Task inference thereby becomes model weight generation.
