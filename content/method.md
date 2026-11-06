An **encoder** reads the three examples and summarises the task as a vector. A
**decoder** turns that vector into every weight of a tiny Transformer (1,204
parameters), which then solves new inputs without seeing the examples again.
