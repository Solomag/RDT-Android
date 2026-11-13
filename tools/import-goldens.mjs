// node tools/import-goldens.mjs [PC data dir]   (npm run goldens:import)
// Copies the PC tracker's goldens into tests/golden (local only, gitignored):
//   replays\<name>.rdtrec + replay-results\<name>.txt -> tests/golden/<name>/{recording.rdtrec, expected.txt}
//   cards.json -> tests/golden/cards.json
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
process.chdir(fileURLToPath(new URL("..", import.meta.url)));

const pc = process.argv[2] ?? join(process.env.APPDATA ?? "", "RebornDeckTracker");
const results = join(pc, "replay-results");
if (!existsSync(results)) { console.error(`no ${results}; write "all" into replay-request.txt with the PC game in the menu`); process.exit(2); }
mkdirSync("tests/golden", { recursive: true });
let n = 0;
for (const f of readdirSync(results).filter(f => f.endsWith(".txt"))) {
  const name = f.slice(0, -4), rec = join(pc, "replays", `${name}.rdtrec`);
  if (!existsSync(rec)) { console.log(`skip ${name}: recording not found`); continue; }
  mkdirSync(`tests/golden/${name}`, { recursive: true });
  copyFileSync(rec, `tests/golden/${name}/recording.rdtrec`);
  copyFileSync(join(results, f), `tests/golden/${name}/expected.txt`);
  n++;
}
if (existsSync(join(pc, "cards.json"))) copyFileSync(join(pc, "cards.json"), "tests/golden/cards.json");
console.log(`imported ${n} goldens${existsSync("tests/golden/cards.json") ? " and cards.json" : ""}`);
