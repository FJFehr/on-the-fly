"""Export the two trained hypernetworks to demo/weights.json for the in-browser demo.

Run from the on-the-fly-models repo (it imports that repo's model code):

    cd ../on-the-fly-models
    uv run python ../on-the-fly/demo/export_weights.py \
        outputs/02_hypernetwork_multitask_refactor/hyper_multitask_dim4_notd_seed4/best_model.ckpt \
        outputs/02_hypernetwork_multitask_refactor/hyper_multitask_dim4_frozentd_seed4/best_model.ckpt

The first checkpoint generates from the examples alone; the second also gets the task ID.
Writes demo/weights.json (both models, preset episodes) and, with --reference, PyTorch
predictions on every test episode that demo/check.mjs compares the JS port against.
"""

import argparse
import json
import random
import sys
from pathlib import Path

import pyarrow as pa
import torch
import torch.nn.functional as F

sys.path.insert(0, ".")
from models.embedding import TASK_CATEGORY_INDEX, TokenEmbedder  # noqa: E402
from models.hypernetwork import Hypernetwork  # noqa: E402
from models.transformer import Transformer  # noqa: E402
from sklearn.manifold import TSNE  # noqa: E402
from visualisation.paper.plot_embedding_clusters import build_display_categories  # noqa: E402

# Training batches mix many tasks and are padded to the longest one, which for the 14
# paper tasks is always 35. Attention has no padding mask, so the model expects that
# padding: inference must pad to 35 too (unpadded, test exact match drops from 65% to 35%).
PAD_LENGTH = 35
PAD = 10
CATEGORIES = (
    "denoising_1c denoising_mc fill flip hollow mirror move_1p move_2p move_2p_dp "
    "move_3p move_dp pcopy_1c pcopy_mc scale_dp"
).split()
# Display label and colour of each task: exactly as in the paper's t-SNE figure.
_display, _, COLOR = build_display_categories(["1d_" + c for c in CATEGORIES])
LABELS = dict(zip(CATEGORIES, _display))
# The preset tasks, in display order: every task.
PRESETS = CATEGORIES
NUM_EXTRA_QUERIES = 3
OUT = Path(__file__).parent


def load(checkpoint: str) -> tuple[TokenEmbedder, Hypernetwork]:
    state = torch.load(checkpoint, map_location="cpu", weights_only=False)["state_dict"]
    task_proj = state.get("hypernetwork.task_indicator_proj.weight")
    embedder = TokenEmbedder(4, 11)
    hypernetwork = Hypernetwork(
        Transformer(4, 4, 1, 1, output_dim=4),
        Transformer(4, 4, 3, 1, output_dim=10),
        encoder_dim=4,
        bottleneck_dim=8,
        num_tasks=None if task_proj is None else task_proj.shape[1],
    )
    embedder.load_state_dict({k[9:]: v for k, v in state.items() if k.startswith("embedder.")})
    hypernetwork.load_state_dict(
        {k[13:]: v for k, v in state.items() if k.startswith("hypernetwork.")}
    )
    return embedder.eval(), hypernetwork.eval()


def read_arrow(path: str) -> list[dict]:
    with pa.memory_map(path) as f:
        return pa.ipc.open_stream(f).read_all().to_pylist()


def test_episodes() -> list[dict]:
    rows = read_arrow("data/arc_1d_looped_augmented/test/data-00000-of-00001.arrow")
    return [r for r in rows if r["task_category"][3:] in CATEGORIES]


def pad(x: torch.Tensor) -> torch.Tensor:
    return F.pad(x, (0, PAD_LENGTH - x.shape[-1]), value=PAD)


class Model:
    def __init__(self, checkpoint: str):
        self.checkpoint = checkpoint
        self.embedder, self.hypernetwork = load(checkpoint)
        self.uses_task_id = self.hypernetwork.task_indicator_proj is not None

    @torch.no_grad()
    def generate(self, episode: dict) -> torch.Tensor:
        """Same serialisation as HypernetworkLightning.embed_context, for one episode."""
        si = pad(torch.tensor(episode["support_inputs"]))
        so = pad(torch.tensor(episode["support_outputs"]))
        tokens = torch.stack([s for i in range(3) for s in (si[i], so[i])]).reshape(-1)
        example_ids = torch.tensor([0, 0, 1, 1, 2, 2]).repeat_interleave(PAD_LENGTH)
        role_ids = torch.tensor([0, 1, 0, 1, 0, 1]).repeat_interleave(PAD_LENGTH)
        positions = torch.arange(PAD_LENGTH).repeat(6)
        context = self.embedder(tokens[None], positions[None], example_ids[None], role_ids[None])
        task_ids = None
        if self.uses_task_id:
            task_ids = torch.tensor([TASK_CATEGORY_INDEX[episode["task_category"]]])
        return self.hypernetwork.generate_weights(context, task_ids)

    @torch.no_grad()
    def run(self, weights: torch.Tensor, queries: list[list[int]]) -> list[list[int]]:
        """Run one generated model on several query inputs at once."""
        x = torch.stack([pad(torch.tensor(q)) for q in queries])
        logits = self.hypernetwork.run_target(weights, self.embedder(x[None], None))[0]
        return [p[: len(q)] for p, q in zip(logits.argmax(-1).tolist(), queries)]

    def export(self) -> dict:
        params = {f"embedder.{k}": as_list(v) for k, v in self.embedder.state_dict().items()}
        for k, v in self.hypernetwork.state_dict().items():
            if not k.startswith("target.") and "rope" not in k:  # target is generated; RoPE is fixed
                params[k] = as_list(v.flatten() if k == "pooler.query" else v)
        return {
            "source": self.checkpoint,
            "uses_task_id": self.uses_task_id,
            "pad_length": PAD_LENGTH,
            "pad_value": PAD,
            "encoder_layers": 1,
            "target_layers": 3,
            "target_shapes": [[n, list(s)] for n, s in self.hypernetwork.target_shapes],
            "params": params,
        }


def as_list(t: torch.Tensor):
    return [round(v, 7) for v in t.flatten().tolist()] if t.dim() == 1 else [as_list(r) for r in t]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("checkpoints", nargs="+", help="without task ID first, then with")
    parser.add_argument("--reference", help="also write PyTorch test predictions here")
    args = parser.parse_args()

    models = [Model(c) for c in args.checkpoints]
    episodes = test_episodes()
    by_category: dict[str, list[dict]] = {}
    for e in episodes:
        e["weights"], e["z"] = [], []
        for m in models:
            e["weights"].append(m.generate(e))
            e["z"].append(m.hypernetwork.last_task_representation[0])
        e["prediction"] = [m.run(w, [e["query_input"]])[0] for m, w in zip(models, e["weights"])]
        e["solved"] = [p == e["query_output"] for p in e["prediction"]]
        by_category.setdefault(e["task_category"][3:], []).append(e)

    presets = []
    for category in PRESETS:
        group = by_category[category]
        queries = [o["query_input"] for o in group]

        # The support set whose generated models solve the most queries across this
        # category (summed over models); the extra inputs shown are a fixed random draw,
        # so they show each model's real accuracy rather than its best cases.
        def total_solved(e):
            return sum(p == o["query_output"]
                       for m, w in zip(models, e["weights"]) for p, o in zip(m.run(w, queries), group))

        # Prefer a set both models solve; some tasks have none (the no-task-ID model fails
        # them), so fall back to the best set overall.
        best = max(group, key=lambda e: (sum(e["solved"]), total_solved(e)))
        others = [o for o in group if o is not best]
        shown = [best] + random.Random(0).sample(others, NUM_EXTRA_QUERIES)
        presets.append({
            "category": category,
            "task_index": TASK_CATEGORY_INDEX["1d_" + category],
            "label": LABELS[category],
            "test_exact_match": [
                round(sum(e["solved"][i] for e in group) / len(group), 2) for i in range(len(models))
            ],
            "support_inputs": best["support_inputs"],
            "support_outputs": best["support_outputs"],
            "queries": [{"input": q["query_input"], "output": q["query_output"]} for q in shown],
        })
        print(f"{category}: test exact match {presets[-1]['test_exact_match']}")

    # Task map: t-SNE of every test episode's task vector z (the 4 numbers the weights are
    # decoded from), with the paper's settings (visualisation/core/embedding_clusters.py).
    # The demo places a newly generated model by its nearest neighbours in z.
    exported = [m.export() for m in models]
    for k, model in enumerate(exported):
        z = torch.stack([e["z"][k] for e in episodes]).numpy()
        xy = TSNE(n_components=2, perplexity=30.0, init="pca", random_state=0).fit_transform(z)
        xy = (xy - xy.min(0)) / (xy.max(0) - xy.min(0))
        model["map"] = {
            "z": [[round(float(v), 5) for v in r] for r in z],
            "xy": [[round(float(v), 4) for v in r] for r in xy],
            "category": [CATEGORIES.index(e["task_category"][3:]) for e in episodes],
        }
    out = {
        "categories": [{"key": c, "label": LABELS[c], "color": COLOR[LABELS[c]]} for c in CATEGORIES],
        "models": exported,
        "presets": presets,
    }
    (OUT / "weights.json").write_text(json.dumps(out, separators=(",", ":")))
    print("wrote", OUT / "weights.json")

    if args.reference:
        ref = [{
            "task_index": TASK_CATEGORY_INDEX[e["task_category"]],
            "support_inputs": e["support_inputs"], "support_outputs": e["support_outputs"],
            "query_input": e["query_input"], "prediction": e["prediction"],
            "weights_head": [w[0, :8].tolist() for w in e["weights"]],
            "z": [z.tolist() for z in e["z"]],
        } for e in episodes]
        Path(args.reference).write_text(json.dumps(ref))
        print("wrote", args.reference)


if __name__ == "__main__":
    main()
