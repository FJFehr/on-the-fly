### From Task Identification to Model Construction

Our results show that a few demonstrations can be compiled directly into the weights of tiny specialist models, which can then be reused independently. The generated weights form a structured space, supporting partial generalisation to new compositions and unseen transformations. Rather than identifying and selecting predefined functions, a general-purpose model could infer a function from demonstrations and construct a compact specialist that executes it independently. The improved generalisation without explicit task identifiers further supports this direction.

### Towards Local and Personalised Specialists

Generated weights could provide a form of task-specific pretraining, giving compact models a useful initialisation from only a few demonstrations. These specialists could then be fine-tuned or personalised using local data and executed independently, potentially on resource-constrained hardware. However, our experiments do not yet establish practical benefits in latency, memory, compute, privacy, or security, nor how the approach scales beyond tiny models.

### Future Directions

Two directions are particularly interesting: extending weight generation to richer reasoning tasks such as ARC-AGI, potentially using looped or recursive specialists, and scaling to larger models through structured parameter spaces such as adapters or LoRA updates. More broadly, a large pretrained model could act as a model generator, constructing task-specific specialists on demand that can be further refined and deployed independently.
