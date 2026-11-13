// The protobuf decoder/encoder against the schema: synthetic messages always; local recordings when present
// (decode -> encode must give back the exact recorded bytes, the strongest check that the schema is right).
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { decodeHistoryQueue, encodeMessage, decodeChunks, ChunkQueue } from "../build/core.mjs";

test("synthetic HistoryQueue round-trips with proto3 defaults, negatives and packed repeats", () => {
  const card = { CardNetUid: 257, CardId: -1234567, CurrentPosition: { OwningPlayerUid: 1000, GameZoneName: 4, LaneIndex: 0 },
    AffectedAttributeName: [1, 2, 300], AffectedAttributeValue: [-1, 0, 7], IsRevealed: true };
  const queue = { Queue: [{ Type: 20000, ActingPlayerInstanceId: 1000, AffectedCardsArray: [card],
    MatchIntroPlayers: [{ PlayerInstanceId: 1000, PlayerName: "Тест", IsHuman: true, DeckColorNames: [1, 4] }] }] };
  const bytes = encodeMessage(queue, "CcgRpc.HistoryQueue");
  const back = decodeHistoryQueue(bytes);
  const item = back.Queue[0];
  assert.equal(item.Type, 20000);
  assert.equal(item.TargetCardNetUid, 0);             // default
  assert.equal(item.FullGameState, null);             // absent message
  assert.deepEqual(item.AffectedLanesArray, []);       // absent repeated
  const c = item.AffectedCardsArray[0];
  assert.equal(c.CardId, -1234567);
  assert.deepEqual(c.AffectedAttributeValue, [-1, 0, 7]);
  assert.equal(c.CurrentPosition.GameZoneName, 4);
  assert.equal(c.IsRevealed, true);
  assert.equal(item.MatchIntroPlayers[0].PlayerName, "Тест");
  assert.deepEqual(Buffer.from(encodeMessage(back, "CcgRpc.HistoryQueue")), Buffer.from(bytes));
});

test("unknown fields are skipped and counted", () => {
  // field 99 (varint 5), then Queue item with Type 10
  const bytes = Uint8Array.from([0x98, 0x06, 5, 0x0a, 2, 0x08, 10]);
  const stats = { unknownFields: 0 };
  const q = decodeHistoryQueue(bytes, stats);
  assert.equal(stats.unknownFields, 1);
  assert.equal(q.Queue[0].Type, 10);
});

const dirs = ["recordings", "tests/golden"].filter(existsSync);
const files = dirs.flatMap(d => readdirSync(d, { recursive: true }).filter(f => String(f).endsWith(".rdtrec")).map(f => `${d}/${f}`));
test(`recorded queues round-trip byte for byte (${files.length} local recordings)`, { skip: files.length === 0 && "no local recordings" }, () => {
  for (const f of files) {
    for (const c of decodeChunks(new Uint8Array(readFileSync(f)))) {
      if (c.type !== ChunkQueue) continue;
      const stats = { unknownFields: 0 };
      const back = encodeMessage(decodeHistoryQueue(c.data, stats), "CcgRpc.HistoryQueue");
      assert.equal(stats.unknownFields, 0, f);
      assert.deepEqual(Buffer.from(back), Buffer.from(c.data), f);
    }
  }
});
