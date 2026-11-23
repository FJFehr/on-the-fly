We ablate two design choices by repeating the capacity experiment: removing the
[Canon layers](https://openreview.net/forum?id=kxv0M6I7Ud), short 1D
convolutions placed throughout each Transformer block, and replacing the
[Muon](https://arxiv.org/abs/2502.16982) optimiser with AdamW. Both may be
useful to others training tiny models. In both plots, solid lines show our
setup and dashed lines the ablation; bands show ±1 s.d. across 5 seeds.
