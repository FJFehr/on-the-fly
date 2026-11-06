We train a 10K-parameter hypernetwork across all 14 transformations. It maps
the support set to the complete parameters of a 1.4K-parameter target model.
We compare generation from the support set alone with a variant that also
receives a frozen task-ID embedding.

The generated models largely recover the performance of individually trained
specialists.
