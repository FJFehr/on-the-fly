Do the generated weights encode functions that work beyond the support set
they came from? We test three settings.

**Generate once, execute many.** For each transformation, we generate a model
from one support set, freeze it, and run it on every other query of that
transformation, with no further context or training. Accuracy stays close to
that on the paired query, with or without task IDs. A generated specialist can
be built once and reused.
