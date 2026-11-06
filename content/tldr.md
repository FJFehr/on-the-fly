**TL;DR.** General-purpose models can adapt to many tasks from context, while
tiny specialist models can execute individual functions with less capacity, but
typically require task-specific training. We show that a hypernetwork can
generate the weights of tiny specialist models directly from a few
demonstrations, using ARC-1D as a controlled testbed. The generated weights
form a structured space, and the resulting specialists show partial
compositional generalisation and generalisation to transformations not seen
during training. Together, these results suggest that a few examples can be
compiled on-the-fly into compact executable models, whose weights can be
reused and partially recombined to generalise beyond known functions.
