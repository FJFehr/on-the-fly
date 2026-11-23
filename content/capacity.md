We hypothesise that the parameters a model requires grow with the number of
tasks it must solve. To explore this, we train a three-layer Transformer at
several widths, from 1.4K to 5.4K parameters, in two ways: as *individual
models*, one per transformation, and as a *joint model* covering the whole
task set. Every model maps one input to its output, without support examples;
the joint model may also receive a *task ID*, a learned embedding which
identifies the transformation to apply (analogous to HRM's `puzzle_id`
in ARC-AGI). All models use
[RoPE](https://doi.org/10.1016/j.neucom.2023.127063), together with
[Canon layers](#ablation-canon) and the [Muon optimiser](#ablation-muon), both of which we ablate.
