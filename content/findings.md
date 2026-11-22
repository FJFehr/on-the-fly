**Canon layers.** A Canon layer is a short 1D convolution that mixes each token
with its neighbours, applied throughout the network. It was proposed to help
multi-hop reasoning in larger language models. Here it gives tiny models the
right inductive bias for 1D sequence tasks: it improves exact match in every
setting, most of all at low capacity.

**Muon.** Muon matches or beats AdamW in every setting. The gap is larger for
joint models than for individual ones. One caveat: the AdamW learning rate was
not tuned separately for this comparison.
