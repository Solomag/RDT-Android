// The phone's live path (frida/live.ts) fed with recorded queues must log the same window and CHECK lines as the
// replay of the same recording (and so as the PC). Runs on the local goldens when present.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { decodeChunks, readHeader, replay, ChunkQueue, dbSource } from "../build/core.mjs";
import { startLive } from "../build/live.mjs";
import { normalize } from "../tools/normalize.mjs";

const root = "tests/golden";
const cardsFile = existsSync(`${root}/cards.json`) ? JSON.parse(readFileSync(`${root}/cards.json`, "utf8")) : null;
const names = existsSync(root) ? readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name) : [];

test(`live path equals the replay (${names.length} local goldens)`, { skip: (!cardsFile || names.length === 0) && "no local goldens" }, () => {
  for (const name of names) {
    const chunks = decodeChunks(new Uint8Array(readFileSync(`${root}/${name}/recording.rdtrec`)));
    const header = readHeader(chunks);
    if (!header.code) continue; // the live side needs the deck from the inventory; the replay of these tracks nothing
    const lines = [];
    globalThis.File = class { constructor() {} write(s) { lines.push(...String(s).trimEnd().split("\n").map(l => l.replace(/^\S+ /, ""))); } flush() {} close() {} };
    const portLog = [];
    const source = dbSource(cardsFile.cards);
    const onQueue = startLive({ log: m => portLog.push(m) }, "/x", source);
    // the inventory deck = the recorded code, decoded the same way
    const deck = () => ({ id: header.deck, name: header.name ?? "", cards: new Map([...replayDeck(header.code, source)]) });
    for (const c of chunks) if (c.type === ChunkQueue) onQueue({ translator: "t1", bytes: c.data, handle: "h", pastHandle: () => "", local: Number(header.local), deck });
    const want = normalize(replay(chunks, { cards: cardsFile.cards }, name).join("\n")).filter(l => !l.startsWith("=== REPLAY END"));
    assert.deepEqual(normalize(lines.join("\n")), want, name);
    assert.ok(portLog.some(l => l.startsWith("CHECK:")), "CHECK goes to the port log");
  }
});

import { Cards } from "../build/core.mjs";
function replayDeck(code, source) { return new Cards(source).decodeDeckCode(code).cards; }
