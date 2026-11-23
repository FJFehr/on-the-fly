We show that a model with few parameters can solve an individual ARC-1D
transformation. However, learning all 14 jointly requires more capacity,
and a task-ID embedding narrows the gap considerably. The burden therefore
comes from holding many transformations in shared parameters and knowing when
to apply them. Ideally, the model carrying out a transformation would be
lightweight, specialised and relieved of that choice. This motivates
decoupling task inference from execution. *Given that a tiny network can represent each solution,
can a hypernetwork learn to generate those networks from examples?*
