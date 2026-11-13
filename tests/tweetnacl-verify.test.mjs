// The vendored verify-only TweetNaCl agrees with node:crypto ed25519, including the release message format.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { generateKeyPairSync, sign, randomBytes } from "node:crypto";
const verify = createRequire(import.meta.url)("../vendor/tweetnacl-verify.js");

test("accepts node:crypto signatures, rejects tampering", () => {
  for (let k = 0; k < 5; k++) {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const pk = new Uint8Array(publicKey.export({ type: "spki", format: "der" }).subarray(-32));
    for (const len of [0, 1, 70, 300]) {
      const msg = k === 0 && len === 70 ? new Uint8Array(Buffer.from(`${"ab".repeat(32)}:12`, "utf8")) : new Uint8Array(randomBytes(len));
      const sig = new Uint8Array(sign(null, msg, privateKey));
      assert.equal(verify(msg, sig, pk), true);
      const badSig = sig.slice(); badSig[k % 64] ^= 1;
      assert.equal(verify(msg, badSig, pk), false);
      if (len) { const badMsg = msg.slice(); badMsg[0] ^= 0x80; assert.equal(verify(badMsg, sig, pk), false); }
      const badPk = pk.slice(); badPk[3] ^= 4;
      assert.equal(verify(msg, sig, badPk), false);
    }
  }
  assert.throws(() => verify(new Uint8Array(1), new Uint8Array(63), new Uint8Array(32)));
});
