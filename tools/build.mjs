// node tools/build.mjs          -> build/rdt.js (the module for the phone, one IIFE, ES2020 like the port)
// node tools/build.mjs --node   -> also build/core.mjs (platform-free core for the Node tests)
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
process.chdir(fileURLToPath(new URL("..", import.meta.url)));

const MARK = "// RDT-ANDROID-MODULE v1\n";
await build({
  entryPoints: ["src/frida/main.ts"], bundle: true, format: "iife", target: "es2020",
  platform: "neutral", outfile: "build/rdt.js", legalComments: "inline", banner: { js: MARK },
});
const code = readFileSync("build/rdt.js", "utf8");
if (!code.startsWith(MARK)) throw Error("module marker missing");
const sha256 = createHash("sha256").update(code).digest("hex");
writeFileSync("build/rdt.meta.json", JSON.stringify({ bytes: Buffer.byteLength(code), sha256 }, null, 2) + "\n");
console.log(`built build/rdt.js (${Buffer.byteLength(code)} bytes, sha256 ${sha256.slice(0, 12)})`);

if (process.argv.includes("--node")) {
  await build({ entryPoints: ["src/core/index.ts"], bundle: true, format: "esm", platform: "node", target: "node20", outfile: "build/core.mjs" });
  // the phone's live path, for the Node test that feeds it recorded queues (globals like File come from the test)
  await build({ entryPoints: ["src/frida/live.ts"], bundle: true, format: "esm", platform: "node", target: "node20", outfile: "build/live.mjs" });
  console.log("built build/core.mjs, build/live.mjs");
}
