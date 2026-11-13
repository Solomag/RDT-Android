// node tools/keygen.mjs <path-outside-the-repo.pem>
// Creates the ed25519 release key. The private key stays with the user, outside every repo;
// the printed public key (hex, 32 bytes) is pinned in the port's RDT loader.
import { generateKeyPairSync } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const target = process.argv[2];
if (!target) { console.error("usage: node tools/keygen.mjs <path-outside-the-repo.pem>"); process.exit(2); }
const repo = fileURLToPath(new URL("..", import.meta.url));
const rel = relative(repo, resolve(target));
if (!rel.startsWith("..") && !/^[a-z]:/i.test(rel)) { console.error("refusing: the key must be outside the repository"); process.exit(2); }
if (existsSync(target)) { console.error("refusing: file exists"); process.exit(2); }
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
writeFileSync(target, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
const raw = publicKey.export({ type: "spki", format: "der" }).subarray(-32);
console.log(`private key written to ${target}`);
console.log(`public key (pin in the loader): ${raw.toString("hex")}`);
