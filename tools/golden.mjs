// node tools/golden.mjs [name]   (npm run golden)
// Runs the TS core over every tests/golden/<name>/recording.rdtrec and compares the normalized lines with
// tests/golden/<name>/expected.txt (the PC tracker's replay-result.txt for the same recording).
// Goldens are local only (gitignored: they hold real matches); cards come from tests/golden/cards.json.
// Prints one line per golden and the first difference; exit code 1 when any differs.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { decodeChunks, replay } from "../build/core.mjs";
import { normalize } from "./normalize.mjs";
process.chdir(fileURLToPath(new URL("..", import.meta.url)));

const root = "tests/golden";
if (!existsSync(root)) { console.log("no goldens (tests/golden is empty)"); process.exit(0); }
const cards = existsSync(`${root}/cards.json`) ? JSON.parse(readFileSync(`${root}/cards.json`, "utf8")) : {};
const only = process.argv[2];
let pass = 0, fail = 0;
for (const name of readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort()) {
  if (only && name !== only) continue;
  const dir = `${root}/${name}`;
  if (!existsSync(`${dir}/recording.rdtrec`) || !existsSync(`${dir}/expected.txt`)) continue;
  const want = normalize(readFileSync(`${dir}/expected.txt`, "utf8"));
  let got;
  try { got = normalize(replay(decodeChunks(new Uint8Array(readFileSync(`${dir}/recording.rdtrec`))), cards, name).join("\n")); }
  catch (e) { got = [`(core threw: ${e?.stack ?? e})`]; }
  const at = want.findIndex((l, i) => l !== got[i]);
  const same = at < 0 && want.length === got.length;
  if (same) { pass++; console.log(`ok   ${name} (${want.length} lines)`); continue; }
  fail++;
  const i = at < 0 ? Math.min(want.length, got.length) : at;
  console.log(`FAIL ${name}: line ${i + 1} of ${want.length}\n  want: ${want[i] ?? "(end)"}\n  got:  ${got[i] ?? "(end)"}`);
}
console.log(`golden: ${pass} ok, ${fail} differ`);
process.exit(fail ? 1 : 0);
