For **unseen generalisation**, we use a leave-one-out design: we withhold each
of the 14 transformations in turn and train on the remaining 13. We score each
model in-distribution, on the transformations it learned, and on the held-out
functions.
