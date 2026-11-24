// Browser test for painting cells in the demo: click paints a cell, a second click undoes it.
// Checks the example rows (x and y) in step 1, before and after generating, and the
// new input x′ in step 3.
//
// Usage (serve the site first, e.g. `python3 -m http.server 8000` in the repo root):
//   PLAYWRIGHT=/path/to/node_modules/playwright-core node demo/test-paint.cjs [url]
// PLAYWRIGHT defaults to `playwright-core` on the normal require path. Chrome defaults
// to /usr/bin/google-chrome; set CHROME to override.
const { chromium } = require(process.env.PLAYWRIGHT || "playwright-core");

const URL = process.argv[2] || "http://127.0.0.1:8000/";
const RED = 1;
let failures = 0;

function check(name, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log((ok ? "PASS " : "FAIL ") + name + ": got " + actual + ", expected " + expected);
}

(async function () {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome" });
  const page = await browser.newPage();
  page.on("pageerror", function (err) { failures++; console.log("FAIL page error: " + err.message); });
  await page.goto(URL);
  // No task is preselected: the examples appear once one is picked.
  await page.locator(".otf-tab", { hasText: /^Flip$/ }).click();
  await page.waitForSelector(".otf-step .otf-line button.otf-cell");

  // Step containers: [0] examples, [1] generate, [2] run. The example-episode figure higher up
  // the page (.otf-episode) uses the same box class, so it is left out.
  const step = function (k) { return page.locator(".otf-demo:not(.otf-episode) .otf-step").nth(k); };
  // Rows are found by their label's TeX source ("x_1", "x'"), which KaTeX keeps in an
  // <annotation> element next to the typeset maths.
  const cells = function (k, label) {
    return step(k).locator(".otf-line", { has: page.locator(".otf-label annotation", { hasText: new RegExp("^" + label + "$") }) })
      .locator("button.otf-cell");
  };
  const value = async function (k, label, i) {
    const aria = await cells(k, label).nth(i).getAttribute("aria-label");
    return Number(aria.split("colour ")[1]);
  };
  const firstCell = async function (k, label, test) {
    const n = await cells(k, label).count();
    for (let i = 0; i < n; i++) if (test(await value(k, label, i))) return i;
    return -1;
  };

  // Paint a cell red, then click it again: it must return to its starting value.
  async function roundTrip(k, label, test, what) {
    const i = await firstCell(k, label, test);
    if (i < 0) { failures++; console.log("FAIL " + label + ": no " + what + " cell found"); return; }
    const before = await value(k, label, i);
    await cells(k, label).nth(i).click();
    check(label + " " + what + " cell " + i + " first click paints red", await value(k, label, i), RED);
    await cells(k, label).nth(i).click();
    check(label + " " + what + " cell " + i + " second click restores", await value(k, label, i), before);
  }

  async function pickRed(k) {
    await step(k).locator('.otf-swatch[aria-label="Paint colour ' + RED + '"]').click();
  }

  for (const phase of ["before generating", "after generating"]) {
    console.log("-- step 1, " + phase);
    if (phase === "after generating") await step(1).locator("button.otf-primary").click();
    await pickRed(0);
    for (const label of ["x_1", "y_1", "x_3"]) {
      await roundTrip(0, label, function (v) { return v === 0; }, "background");
      await roundTrip(0, label, function (v) { return v !== 0 && v !== RED; }, "coloured");
    }
  }

  console.log("-- step 3");
  await pickRed(2);
  await roundTrip(2, "x'", function (v) { return v === 0; }, "background");
  await roundTrip(2, "x'", function (v) { return v !== 0 && v !== RED; }, "coloured");

  await browser.close();
  console.log(failures ? failures + " failure(s)" : "all passed");
  process.exit(failures ? 1 : 0);
})();
