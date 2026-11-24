"""Export one example episode per held-out composition to demo/compositions.json, for the
example figure in the page's generalisation section (renderOnTheFlyEpisode in demo.js).

Run with Python 3.12 from the on-the-fly-models repo. It uses the standard library only and
loads that repo's generator file directly, so no environment has to be installed:

    cd ../on-the-fly-models
    uv run --no-project --python 3.12 python ../on-the-fly/demo/export_compositions.py

The episodes come from the held-out test set itself: scripts/build_arc1d_compositional.py
builds it with the same seed and size.
"""

import importlib.util
import json
import sys
from pathlib import Path

GENERATOR = Path("data_modules/arc1d_compositional.py")
SEED, N_PER_CATEGORY = 0, 40  # as in scripts/build_arc1d_compositional.py
OUT = Path(__file__).parent / "compositions.json"

# Component names as the page writes them. The generator applies a category "<first>_<second>"
# as first, then second, so it is shown as "Second ∘ First": A ∘ B means B first, then A (the
# order of the paper's results table, experiments/04_compositional_generalization).
COMPONENT = {
    "denoise1c": "Denoise", "denoisemc": "Denoise MC", "copy": "Pattern Copy", "mirror": "Mirror",
    "fill": "Fill", "movedynamic": "Move Dynamic", "shift3": "Shift 3", "hollow": "Hollow",
}
# The episode of the paper's fill-then-mirror figure, recognised by its first example input.
PINNED = {"fill_mirror": [0, 0, 0, 0, None, 0, 0, 0, 0, 0, 0, None, 0, 0, 9] + [0] * 10}


def load_generator():
    spec = importlib.util.spec_from_file_location("arc1d_compositional", GENERATOR)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def matches(sequence: list[int], pattern: list) -> bool:
    """None in the pattern stands for any colour that is not background."""
    return len(sequence) == len(pattern) and all(
        (v != 0) if p is None else (v == p) for v, p in zip(sequence, pattern)
    )


def main() -> None:
    tasks = load_generator().generate_dataset(seed=SEED, n_per_category=N_PER_CATEGORY)
    presets = []
    for category in sorted({t["task_category"] for t in tasks}):
        key = category[len("1d_comp_"):]
        group = [t for t in tasks if t["task_category"] == category]
        if key in PINNED:
            chosen = [t for t in group if matches(t["support_inputs"][0], PINNED[key])]
            assert len(chosen) == 1, f"{key}: {len(chosen)} episodes match the pinned figure"
            episode = chosen[0]
        else:
            # The shortest episode: its cells stay largest on a phone.
            episode = min(group, key=lambda t: (t["sequence_length"], t["task_id"]))
        first, second = (COMPONENT[part] for part in key.split("_", 1))
        presets.append({
            "category": key,
            "label": f"{second} ∘ {first}",
            "first": first,
            "second": second,
            "support_inputs": episode["support_inputs"],
            "support_outputs": episode["support_outputs"],
            "queries": [{"input": episode["query_input"], "output": episode["query_output"]}],
        })
        print(f"{presets[-1]['label']}: task {episode['task_id']}, {episode['sequence_length']} cells")
    presets.sort(key=lambda p: p["label"])
    OUT.write_text(json.dumps({"presets": presets}, ensure_ascii=False, separators=(",", ":")))
    print("wrote", OUT)


if __name__ == "__main__":
    main()
