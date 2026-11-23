We train a 10K-parameter hypernetwork across all 14 transformations. It maps
the support set to all 1,204 generated weights of the smallest target model
from above (1.4K parameters; its token embedding is shared with the
hypernetwork and not generated).
We compare generation from the support set alone with a variant that also
receives a frozen task-ID embedding.

With a task ID, the generated models largely recover the performance of
individually trained specialists. Without it, they match the specialists on
roughly half of the transformations and fall behind on the rest, most of all
on the *Move* variants.
