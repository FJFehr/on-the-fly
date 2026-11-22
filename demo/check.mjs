// Compares the JS port with PyTorch predictions on every test episode, for each model.
// Usage: node demo/check.mjs <reference.json>  (written by export_weights.py --reference)
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const { create } = createRequire(import.meta.url)("./hypernet.js");

const data = JSON.parse(readFileSync(new URL("weights.json", import.meta.url)));
const ref = JSON.parse(readFileSync(process.argv[2]));
let failed = false;
data.models.forEach((m, k) => {
  const model = create(m);
  let same = 0, maxDiff = 0;
  const t0 = performance.now();
  for (const e of ref) {
    const z = model.encode(e.support_inputs, e.support_outputs, e.task_index);
    e.z[k].forEach((v, i) => (maxDiff = Math.max(maxDiff, Math.abs(v - z[i]))));
    const w = model.decode(z);
    e.weights_head[k].forEach((v, i) => (maxDiff = Math.max(maxDiff, Math.abs(v - w[i]))));
    if (JSON.stringify(model.predict(w, e.query_input)) === JSON.stringify(e.prediction[k])) same++;
  }
  const ms = (performance.now() - t0) / ref.length;
  console.log(`${m.uses_task_id ? "with" : "without"} task ID: predictions identical ${same}/${ref.length}, ` +
    `max z/weight diff ${maxDiff.toExponential(2)}, ${ms.toFixed(2)} ms/episode`);
  failed ||= same !== ref.length;
});
process.exit(failed ? 1 : 0);
