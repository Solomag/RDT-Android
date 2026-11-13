// Live tracking on the phone: every HistoryQueue (as protobuf bytes from the recorder's hook) goes through the same TS core
// that the golden bench checks against the PC (core/tracker), the way the PC's MatchTracker.OnHistoryQueue drives it.
// Log lines go to <external files>/rdt/Match.log (like the PC's Match.log); CHECK also to the port's log. M5 step 1: no UI yet.
import { decodeHistoryQueue } from "../core/proto/decode";
import { Cards } from "../core/tracker/cards";
import { Tracker } from "../core/tracker/tracker";
import { gameCardSource } from "./cardsource";
import type { QueueEvent } from "./recorder";
import type { TeslPort } from "./port";
import type { CardSource } from "../core/tracker/cards";

const TypeFullGameState = 11;

export interface Live { onQueue: (e: QueueEvent) => void; current: () => Tracker | null; onDeckLoaded?: () => void }

export function startLive(p: TeslPort, logDir: string, source?: CardSource, makeDirs?: (path: string) => void): Live {
  const cards = new Cards(source ?? gameCardSource(p, m => p.log(m)));
  // opened on the first line, after creating the folder (a fresh install has no rdt folder yet); retried if it fails
  let log: File | null = null, logTries = 0;
  const write = (line: string) => {
    if (line.startsWith("CHECK:")) p.log(line);
    if (!log && logTries < 3) {
      logTries++;
      try { makeDirs?.(logDir); log = new File(`${logDir}/Match.log`, "a"); }
      catch (e) { p.log(`tracking: no Match.log (${e})`); }
    }
    if (!log) return;
    try { log.write(`${stamp()} ${line}\n`); log.flush(); } catch (_) { /* logging must never stop tracking */ }
  };

  let stream = "", tracker: Tracker | null = null, pending: { queue: any; handle: string }[] = [], pastHandle = "";

  function newMatch(e: QueueEvent) {
    stream = e.translator;
    tracker = new Tracker({ cards, log: write }, e.local);
    pending = [];
    pastHandle = "";
    write("Events: new match stream");
  }

  function loadDeck(e: QueueEvent): boolean {
    const deck = e.deck();
    if (!deck || deck.cards.size === 0) return false;
    let total = 0;
    for (const n of deck.cards.values()) total += n;
    tracker!.loadDeck(deck.cards, deck.name);
    try { live.onDeckLoaded?.(); } catch (_) { /* the window must never stop tracking */ }
    write(`Overlay: deck '${deck.name}' (by id ${deck.id}) ${total} cards, ${deck.cards.size} distinct`);
    if (pending.length > 0) write(`Events: replaying ${pending.length} queued message(s)`);
    const queued = pending;
    pending = [];
    for (const q of queued) process(q.queue, q.handle);
    return true;
  }

  function process(queue: any, handle: string) {
    const t = tracker!;
    const isPast = pastHandle !== "" && handle === pastHandle;
    if (isPast) pastHandle = "";
    t.processQueue(queue, isPast);
  }

  const onQueue = (e: QueueEvent) => {
    if (e.translator !== stream || !tracker) newMatch(e);
    const t = tracker!;
    t.setLocal(e.local);
    const queue = decodeHistoryQueue(e.bytes);
    // a full state may carry the reconnect's past history; the game then passes that object through AddHistoryQueue
    if ((queue.Queue as any[]).some(item => item.Type === TypeFullGameState && item.FullGameState?.HistoryQueue)) pastHandle = e.pastHandle();
    if (!t.deckRows && !loadDeck(e)) {
      if (pending.length < 5000) pending.push({ queue, handle: e.handle });
      return;
    }
    process(queue, e.handle);
    t.publish();
    t.refreshOpponent();
    t.logWindowSnapshot(false);
  };
  const live: Live = { onQueue, current: () => (tracker && tracker.deckRows ? tracker : null) };
  return live;
}

function stamp(): string {
  const d = new Date(), two = (n: number) => String(n).padStart(2, "0");
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
}
