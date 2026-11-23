**TL;DR.** Tiny models can specialise in individual tasks, but lack the
capacity to solve many at once. On ARC-1D, we show that a single hypernetwork
overcomes this by generating the weights of task-specific models from a few
examples. The generated weights form a structured space, and the resulting
models can partially generalise to compositions and transformations not seen
during training.
