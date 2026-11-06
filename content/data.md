[ARC-1D](https://github.com/khalil-research/1D-ARC) is a one-dimensional
variant of ARC-AGI. Inputs and outputs are sequences of coloured cells, and
each transformation involves concepts such as objects, counting and spatial
relations. Each episode gives three support pairs that define the
transformation, plus one query input whose output must be predicted.

We use 14 of the 18 transformation categories, keeping those a standalone
model can execute without seeing the support set again. Each category has 50
episodes, split 40 / 5 / 5 into train, validation and test. Colour remapping
and sequence shifts give 561K augmented training episodes. We report
exact-match accuracy: the whole predicted sequence must be correct.
