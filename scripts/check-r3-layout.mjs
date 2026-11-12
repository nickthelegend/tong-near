import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const directory =
  process.env.TONG_SCREENSHOT_DIR ??
  "/Volumes/Extreme SSD/Projects/grokbot/orchestration/shots/tong/r3";
const viewports = [];
for (const width of [1440, 375]) {
  const before = JSON.parse(
    await readFile(`${directory}/before-${width}-layout.json`, "utf8"),
  );
  const after = JSON.parse(
    await readFile(`${directory}/after-${width}-layout.json`, "utf8"),
  );
  assert.deepEqual(after, before, `Layout changed at ${width}px`);
  viewports.push({
    width,
    matched_elements: Object.keys(before).length,
    layout_identical: true,
    before_screenshot: `before-${width}.png`,
    after_screenshot: `after-${width}.png`,
  });
}
assert.equal(
  execFileSync("git", ["diff", "231db43", "--", "packages/web/src/style.css"], {
    encoding: "utf8",
  }),
  "",
  "CSS must remain unchanged",
);
const result = {
  at: new Date().toISOString(),
  start_commit: "231db43",
  scope: "Copy only; existing components, CSS and layout preserved",
  viewports,
  css_unchanged: true,
};
await writeFile(
  "deployments/r3-ui-qa-2026-11-12.json",
  JSON.stringify(result, null, 2) + "\n",
  { flag: "wx" },
);
console.log(JSON.stringify(result, null, 2));
