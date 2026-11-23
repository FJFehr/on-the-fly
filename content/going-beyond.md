A function inferred from a few examples does not need to stay inside some
monolithic model behind a costly, cloud-deployed API: it can be instantiated
as a compact network that runs on your phone or laptop. Agents today select
predefined tools, and already generate code, skills and programs. *So what if
models generated weights, or even architectures?* Such a generator could
construct task-specific weights on the fly, as a pretrained initialisation or
personalised from minimal local data. Decoupling task inference from execution
has benefits for privacy and security: less reliance on remote servers, and
data that stays on the device. Robotics is the natural next frontier: a
handful of demonstrations could give a small controller that executes locally.

**Conclusion.** Tiny models suffice for individual tasks (such as ARC-1D
transformations), a single hypernetwork can generate such models from a few
examples, and removing the task ID lets them begin to generalise beyond the
training set. Adapting to a new task can therefore be a forward pass rather
than an optimisation: inference is performed once by the generator, and
execution is left to a compact, standalone network.

**Where to next?** During this proof of concept, two directions stood out.
First, richer reasoning: ARC-AGI, then language. Looped and recursive models
depend on biases that restrict their generalisation, such as a `puzzle_id`,
and require costly gradient descent for each new task; generating them from examples
would replace both with a single forward pass. Second, scaling to larger
models: a hypernetwork could learn from the weights
of open models and generate within a constrained space, such as adapters or
LoRA updates. The [code](https://github.com/FJFehr/on-the-fly-models) and the
[demo](#demo) are released. Let's build!
