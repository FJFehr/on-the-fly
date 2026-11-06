**Unseen generalisation.** We withhold each of the 14 transformations in turn,
train on the other 13, and evaluate zero-shot on the held-out one.

In both settings, the task ID helps in-distribution but hurts transfer.
Without it, the hypernetwork reaches higher token accuracy on compositions and
on unseen transformations. Exact solutions remain rare for compositions, but
emerge more clearly for unseen transformations (9.1% vs 0.3%). The support
examples can describe a new function; a task ID cannot.
