// The tracking core over one recording, the way the PC's MatchTracker.RunReplay does it: the deck from the header
// (code; this side has no inventory, so the id/name paths of the PC resolve through the code too), then every message:
// ProcessQueue, Publish, RefreshOpponent, window snapshot; at the end the full snapshot and CHECK unless the game ended.
import { Chunk, ChunkQueue, readHeader } from "../rdtrec";
import { decodeHistoryQueue } from "../proto/decode";
import { Cards, CardDb } from "./cards";
import { Tracker, TrackerEnv } from "./tracker";

export interface ReplayEnv extends Omit<TrackerEnv, "cards"> { cards: Cards | CardDb }

export function replay(chunks: Chunk[], env: ReplayEnv, fileName = "recording"): string[] {
  const cards = env.cards instanceof Cards ? env.cards : new Cards(env.cards);
  const header = readHeader(chunks);
  const local = Number(header.local ?? 0) || 0;
  const deckId = header.deck ?? "0";
  const tracker = new Tracker({ ...env, cards }, local);
  tracker.log(`=== REPLAY ${fileName} (${chunks.length} chunks, local ${local}, deck ${deckId}) ===`);
  const decoded = header.code ? cards.decodeDeckCode(header.code) : null;
  if (decoded) {
    tracker.log(`Overlay: deck '${header.name ?? ""}' (by recorded code, id ${deckId}, code ${header.code}) ${[...decoded.cards.values()].reduce((a, b) => a + b, 0)} cards, ${decoded.cards.size} distinct`);
    tracker.loadDeck(decoded.cards, header.name ?? "");
  } else {
    tracker.log(`Overlay: deck not found in inventory: id ${deckId}, name '${header.name ?? ""}'`);
    tracker.log(`REPLAY: deck ${deckId} not in the inventory, the own deck is not tracked`);
  }
  let processed = 0;
  try {
    for (const c of chunks) {
      if (c.type !== ChunkQueue) continue;
      const queue = decodeHistoryQueue(c.data);
      if (!tracker.deckRows) continue;
      tracker.processQueue(queue);
      tracker.publish();
      tracker.refreshOpponent();
      tracker.logWindowSnapshot(false);
      processed++;
    }
    if (!tracker.gameEnded && tracker.deckRows) { tracker.logWindowSnapshot(true); tracker.logCheck(); }
    tracker.log(`=== REPLAY END (${processed} messages) ===`);
  } catch (e: any) {
    tracker.log(`REPLAY failed after ${processed} messages: ${e?.stack ?? e}`);
  }
  return tracker.lines;
}
