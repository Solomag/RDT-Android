// The release signature scheme, end to end with a throwaway key (never the user's key).
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { generateKeyPairSync, createPublicKey, verify, createHash } from "node:crypto";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, cpSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
// The release workflow sets these for the real key; the test uses its own throwaway key.
const baseEnv = { ...process.env };
delete baseEnv.RDT_PUBLIC_KEY; delete baseEnv.RDT_SIGNING_KEY; delete baseEnv.RDT_CHANNEL_BASE;

test("release signs sha256:revision and the payload matches the manifest", () => {
  const tmp = mkdtempSync(join(tmpdir(), "rdt-release-"));
  try {
    for (const d of ["src", "tools"]) cpSync(join(repo, d), join(tmp, d), { recursive: true });
    cpSync(join(repo, "node_modules"), join(tmp, "node_modules"), { recursive: true });
    const { privateKey } = generateKeyPairSync("ed25519");
    const keyFile = join(tmp, "..", `rdt-test-${process.pid}.pem`);
    writeFileSync(keyFile, privateKey.export({ type: "pkcs8", format: "pem" }));
    try {
      execFileSync(process.execPath, ["tools/release.mjs", "3"], { cwd: tmp, env: { ...baseEnv, RDT_SIGNING_KEY: keyFile, RDT_CHANNEL_BASE: "https://example.invalid/r/" }, stdio: "pipe" });
      const m = JSON.parse(readFileSync(join(tmp, "release/manifest.json"), "utf8"));
      const payload = readFileSync(join(tmp, "release/payloads", `${m.sha256}.js`));
      assert.equal(payload.length, m.bytes);
      assert.equal(createHash("sha256").update(payload).digest("hex"), m.sha256);
      assert.ok(payload.toString("utf8").startsWith("// RDT-ANDROID-MODULE v1\n"));
      assert.ok(verify(null, Buffer.from(`${m.sha256}:3`), createPublicKey(privateKey), Buffer.from(m.sig, "hex")));
      assert.ok(!verify(null, Buffer.from(`${m.sha256}:4`), createPublicKey(privateKey), Buffer.from(m.sig, "hex")));
      assert.equal(m.url, `https://example.invalid/r/payloads/${m.sha256}.js`);
      // a key other than the pinned one never publishes
      assert.throws(() => execFileSync(process.execPath, ["tools/release.mjs", "4"], { cwd: tmp, env: { ...baseEnv, RDT_SIGNING_KEY: keyFile, RDT_PUBLIC_KEY: "00".repeat(32) }, stdio: "pipe" }));
      // the revision may only grow
      assert.throws(() => execFileSync(process.execPath, ["tools/release.mjs", "3"], { cwd: tmp, env: { ...baseEnv, RDT_SIGNING_KEY: keyFile }, stdio: "pipe" }));
    } finally { rmSync(keyFile, { force: true }); }
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
