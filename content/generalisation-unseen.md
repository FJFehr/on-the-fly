**Unseen generalisation.** We withhold each of the 14 transformations in turn,
train on the other 13, and evaluate zero-shot on the held-out one.

In both settings, the task ID helps in-distribution but hurts transfer.
Without it, token accuracy is higher on compositions (75.5% vs 67.7%) and on
unseen transformations (81.9% vs 68.5%), where it improves for 13 of the 14
held-out transformations. Exact solutions remain rare: about 1% on
compositions, and 9.1% vs 0.3% on unseen transformations, most of them on
*Pattern Copy*. The support examples can describe a new function; a task ID
cannot.
