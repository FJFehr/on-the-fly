**Data.** [ARC-1D](https://github.com/khalil-research/1D-ARC) is a one-dimensional
variant of [ARC-AGI](https://arcprize.org/arc-agi): a benchmark combining abstract
reasoning and sequence modelling, in which each task is a transformation that
must be inferred from a few examples. An **episode** comprises a support set of three
input–output pairs and a query, all sharing one transformation. We use the 14
of its 18 transformations that a standalone model can execute without the
examples. Each training episode is augmented 1,000 times by remapping colours
and shifting sequences, giving a total of 561K episodes.
