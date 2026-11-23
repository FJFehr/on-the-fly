### Limitations

- **A controlled testbed.** ARC-1D has a small set of transformations and the generated models are tiny. We do not yet know whether weight generation scales to richer settings such as ARC-AGI, or to larger models.
- **Few-shot at inference, not in training.** Each specialist is generated from three examples, but the hypernetwork itself is trained on 561K augmented episodes. Sharing one hypernetwork across transformations also gave no data-efficiency gain over individual models at this scale.
- **Partial generalisation.** Token accuracy transfers to new functions, but exact solutions are rare: about 1% on held-out compositions.
