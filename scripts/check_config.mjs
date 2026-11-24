// Checks project.yaml with the page's own parser (template/js/yaml-lite.js): every section has
// a unique id, every block a type, every file a block points at exists, and every key-finding
// card links to a real section. A typo otherwise ships as a silently wrong page.
// Usage: node scripts/check_config.mjs   (exits 1 and lists the problems if any)
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const read = (file) => readFileSync(new URL(file, root), "utf8");
const page = {};
vm.runInNewContext(read("template/js/yaml-lite.js"), page);  // defines page.parseYamlLite

const FILE_KEYS = ["source", "src", "src_dark", "still", "still_dark", "stylesheet", "weights"];
const problems = [];
const sections = page.parseYamlLite(read("project.yaml")).sections || [];
const ids = sections.map((s) => s.id);

sections.forEach((section, i) => {
  if (!section.id) problems.push(`section ${i + 1} has no id`);
  else if (ids.indexOf(section.id) !== i) problems.push(`section id "${section.id}" is used twice`);
  (section.blocks || []).forEach((block, j) => {
    const where = `section "${section.id}", block ${j + 1}`;
    if (!block.type) problems.push(`${where} has no type`);
    // A figure_row holds figure blocks of its own.
    [block].concat(block.figures || []).forEach((part) => {
      FILE_KEYS.map((key) => part[key]).concat(part.scripts || []).filter(Boolean).forEach((file) => {
        if (!existsSync(new URL(file, root))) problems.push(`${where}: file not found: ${file}`);
      });
    });
    if (block.type === "takeaways" && block.source && existsSync(new URL(block.source, root))) {
      (page.parseYamlLite(read(block.source)) || []).forEach((card) => {
        if (card.anchor && !ids.includes(card.anchor.slice(1))) {
          problems.push(`${block.source}: "${card.title}" links to ${card.anchor}, which is not a section`);
        }
      });
    }
  });
});

problems.forEach((p) => console.error("FAIL " + p));
console.log(problems.length ? problems.length + " problem(s)" : `project.yaml ok: ${sections.length} sections`);
process.exit(problems.length ? 1 : 0);
