import test from "node:test";
import assert from "node:assert/strict";
import { encodeChunk, decodeChunks, encodeHeader, readHeader, utf8Encode, utf8Decode, ChunkHeader, ChunkQueue } from "../build/core.mjs";

function concat(parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let pos = 0;
  for (const p of parts) { out.set(p, pos); pos += p.length; }
  return out;
}

test("chunks round-trip and a truncated tail is dropped", () => {
  const all = concat([
    encodeChunk(ChunkHeader, encodeHeader({ local: "0", deck: "0" })),
    encodeChunk(ChunkQueue, Uint8Array.from([1, 2, 3])),
    encodeChunk(ChunkHeader, encodeHeader({ local: "7", deck: "123", code: "SPxx", name: "Колода" })),
    encodeChunk(ChunkQueue, Uint8Array.from([9])),
  ]);
  const cut = all.subarray(0, all.length - 1);
  const chunks = decodeChunks(cut);
  assert.equal(chunks.length, 3);
  assert.deepEqual([...chunks[1].data], [1, 2, 3]);
  const h = readHeader(decodeChunks(all));
  assert.equal(h.local, "7");
  assert.equal(h.deck, "123");
  assert.equal(h.name, "Колода");
});

test("same bytes as the PC writer (BitConverter little-endian length)", () => {
  assert.deepEqual([...encodeChunk(1, Uint8Array.from([0xaa, 0xbb]))], [1, 2, 0, 0, 0, 0xaa, 0xbb]);
});

test("utf8 codec matches Buffer", () => {
  for (const s of ["abc", "Тенегрив", "相同颜色", "🃏 x"]) {
    assert.deepEqual(Buffer.from(utf8Encode(s)), Buffer.from(s, "utf8"));
    assert.equal(utf8Decode(Buffer.from(s, "utf8")), s);
  }
});

test("deck code like the PC's GameData.DeckCode", async () => {
  const { deckCode } = await import("../build/core.mjs");
  const codes = { 1: "aa", 2: "bB", 3: "cc", 4: "dd" };
  assert.equal(deckCode(new Map([[1, 3], [2, 1], [3, 3], [4, 2]]), h => codes[h]), "SPABbBABddACaacc");
  assert.equal(deckCode(new Map([[1, 5]]), h => codes[h]), "SPAAAAAAAAABaa");
  assert.equal(deckCode(new Map([[9, 1]]), h => codes[h]), "");
});
