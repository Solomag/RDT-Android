// The tracking core, run over one recording the way the PC's MatchTracker.RunReplay does, returning the log lines.
// M3: an empty core (header only), so the golden bench has something to compare; M4 ports the PC logic step by step.
import { Chunk, ChunkQueue, readHeader } from "../rdtrec";
import { decodeHistoryQueue } from "../proto/decode";

export interface CardDb { [id: string]: { name: string; baseId?: string; cost?: number } }

export function replay(chunks: Chunk[], _cards: CardDb, fileName = "recording"): string[] {
  const header = readHeader(chunks);
  const lines = [`=== REPLAY ${fileName} (${chunks.length} chunks, local ${header.local ?? 0}, deck ${header.deck ?? 0}) ===`];
  let messages = 0;
  for (const c of chunks) {
    if (c.type !== ChunkQueue) continue;
    decodeHistoryQueue(c.data);
    messages++;
  }
  lines.push(`=== REPLAY END (${messages} messages) ===`);
  return lines;
}
