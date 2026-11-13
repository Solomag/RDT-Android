// RDT_SIGNING_KEY=<path to the private .pem, outside the repo> [RDT_PUBLIC_KEY=<pinned hex>] node tools/release.mjs <revision> [minCore]
// Builds the module and writes the signed channel files into release/:
//   release/manifest.json  { revision, minCore, bytes, sha256, sig, url }
//   release/payloads/<sha256>.js
// sig = ed25519 over the UTF-8 string "<sha256>:<revision>" (hex). The loader checks sig with the pinned
// public key, then bytes and sha256 of the payload, and that revision only grows.
// Nothing is pushed: committing and pushing release/ publishes it.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { fileURLToPath } from "node:url";
process.chdir(fileURLToPath(new URL("..", import.meta.url)));

const revision = Number(process.argv[2]);
const minCore = Number(process.argv[3] ?? 0);
if (!Number.isInteger(revision) || revision <= 0) { console.error("usage: node tools/release.mjs <revision> [minCore]"); process.exit(2); }
const keyPath = process.env.RDT_SIGNING_KEY;
if (!keyPath || !existsSync(keyPath)) { console.error("set RDT_SIGNING_KEY to the private key file (outside the repo)"); process.exit(2); }
const base = process.env.RDT_CHANNEL_BASE ?? ""; // e.g. https://raw.githubusercontent.com/<owner>/<repo>/main/release/

if (existsSync("release/manifest.json")) {
  const old = JSON.parse(readFileSync("release/manifest.json", "utf8"));
  if (revision <= old.revision) { console.error(`revision must grow (current ${old.revision})`); process.exit(2); }
}
execFileSync(process.execPath, ["tools/build.mjs"], { stdio: "inherit" });
const code = readFileSync("build/rdt.js");
const { bytes, sha256 } = JSON.parse(readFileSync("build/rdt.meta.json", "utf8"));
const key = createPrivateKey(readFileSync(keyPath));
// RDT_PUBLIC_KEY (hex), when set, must be the key pinned in the port's loader: a wrong key never publishes.
const pinned = process.env.RDT_PUBLIC_KEY;
const own = createPublicKey(key).export({ type: "spki", format: "der" }).subarray(-32).toString("hex");
if (pinned && pinned.toLowerCase() !== own) { console.error("the signing key does not match RDT_PUBLIC_KEY"); process.exit(2); }
const message = Buffer.from(`${sha256}:${revision}`, "utf8");
const sig = sign(null, message, key).toString("hex");
if (!verify(null, message, createPublicKey(key), Buffer.from(sig, "hex"))) throw Error("signature self-check failed");
mkdirSync("release/payloads", { recursive: true });
writeFileSync(`release/payloads/${sha256}.js`, code);
const manifest = { revision, minCore, bytes, sha256, sig, url: `${base}payloads/${sha256}.js` };
writeFileSync("release/manifest.json", JSON.stringify(manifest, null, 2) + "\n");
console.log(`release ${revision}: ${bytes} bytes, sha256 ${sha256.slice(0, 12)}, signed`);
