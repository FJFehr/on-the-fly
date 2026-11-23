With a task ID, the generated models largely match the individual ones.
Without it, they fall behind. The weights nonetheless capture the function
rather than the episode: generated from one support set and then frozen, a
model retains its accuracy on other queries of the same transformation (see
*generate once, execute many* in the
[paper](https://arxiv.org/abs/2610.00820)).
