We train a single 10K-parameter hypernetwork across all 14 transformations. In
one forward pass, it maps a support set to the 1,204 weights of the smallest
target model from above (1.4K parameters; the token embedding is shared with
the hypernetwork). We compare two variants: one
conditioned on the support set alone, and one that also receives a
task-ID embedding, here frozen rather than learned.
