We train a 10K-parameter hypernetwork across all 14 transformations. It maps
the support set to all 1,204 weights of the target model.
We compare generation from the support set alone with a variant that also
receives a frozen task-ID embedding.

The generated models largely recover the performance of individually trained
specialists.
