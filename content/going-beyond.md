### From Task Identification to Model Construction

Our results suggest that few-shot function induction need not remain within a general-purpose model: a function inferred from demonstrations can instead be instantiated as a compact standalone specialist. Task-ID conditioning improves specialisation to known transformations but hinders generalisation beyond them, suggesting that functions can be inferred directly from demonstrations without explicit task identity. This extends the idea of tool use from selecting predefined tools to generating a specialised executable that can be reused independently. More broadly, a pretrained model could act as a model generator, using demonstrations to construct task-specific specialists on the fly.

### Towards Local and Decentralised Execution

Generated weights could provide a form of task-specific pretraining, giving a compact model a useful initialisation from only a few demonstrations. Rather than being the final model, this specialist could then be further fine-tuned or personalised using local data before being executed independently. This could reduce reliance on remote inference and allow task- or user-specific data to remain local, with potential benefits for privacy and security. Our experiments do not yet establish these benefits in latency, memory, compute, privacy, or security, nor how the approach scales beyond tiny target models.

### Future Directions

This proof of concept suggests two directions. First, extending weight generation beyond ARC-1D to richer reasoning settings such as ARC-AGI, including small looped or recursive specialists generated directly from demonstrations without explicit task identifiers. Second, scaling weight generation to larger models through structured or constrained parameter spaces, such as adapters or LoRA updates.
