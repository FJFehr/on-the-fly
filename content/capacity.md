How much capacity does one ARC-1D transformation need? Individual models
saturate at **98.9%** accuracy with only **2.4K parameters**. The same
architecture reaches **74.0%** when trained jointly on all transformations,
even when it is told which transformation to apply. More capacity closes the
gap.

So a single transformation is cheap to represent, but storing many in shared
parameters is expensive. This motivates separating task inference from task
execution: *given that a tiny network can represent each solution, can a
hypernetwork learn to generate those networks from examples?*
