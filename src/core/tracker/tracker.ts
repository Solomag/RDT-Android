// The tracking core, ported from the PC tracker (RebornDeckTracker/Match/MatchTracker.Events.cs, .Deck.cs, .Opponent.cs,
// .Replay.cs snapshot/CHECK, .Picker.cs DeckEntries). Same state, same rules, same log lines where the golden bench
// compares them ("UI deck", "UI opp", "CHECK:"). Input: decoded HistoryQueue objects (proto/decode.ts or the phone adapter).
// Not ported yet (no effect on a replay): clock, pools.txt restore, stats/upload, opponent profiles and deck library choices.
import { Cards, CardMeta } from "./cards";

export class OverlayRow {
  Id = ""; Name = ""; Color = ""; Cost = -1; Category = 1; Unique = false; Prophecy = false;
  Start = 0; Total = 0; Drawn = 0; Copies = 0; Gone = 0; Mods = ""; Cap = Number.MAX_SAFE_INTEGER; Sure = 0;
  ArtId = ""; Premium = false;
  Versions = new Map<string, number>(); VersionDrawn = new Map<string, number>();
  get RawRemaining() { return Math.max(0, this.Total - this.Drawn); }
  get Remaining() { return Math.min(this.Cap, Math.max(0, this.Total - this.Drawn)); }
}

export interface TrackerSettings { showLeft: boolean; countLeftOnly: boolean; artVersions: boolean }
export interface BotDecks { byAiId?: Record<string, string>; byScenario?: Record<string, string>; decks?: Record<string, { name?: string; cards?: { id: string; count: number }[] }> }
export interface TrackerEnv {
  cards: Cards;
  settings?: Partial<TrackerSettings>;
  bots?: BotDecks;
  aiDifficulty?: string;   // RetryData.AiDifficulty (not in the recording)
  scenario?: string;       // RetryData.CampaignData.scenarioName
  log?: (line: string) => void;
}

const ZoneAvatarBoard = 2, ZoneDeck = 3, ZoneHand = 4, ZoneView = 15, ZoneRemoveFromGame = 7, ZoneDeathrattle = 17;
const ZoneAvatarDeck = 10, ZoneAvatarCemetery = 11, ZoneHeroPowerBoard = 12;
const ZoneTypeDeck = 2;
const TypeFullCardRefresh = 30025, TypeFullGameState = 11, TypeGameEnd = 10002, TypeTurnStart = 10005, TypePlayCard = 10007;
const TypeDrawForMulligan = 30072, TypeCreateToken = 30005, TypeTransformCard = 30018, TypeChangeCard = 30050, TypeRedrawForMulligan = 30073;
const TypeAddToDiscard = 30077;
const SubtypeColors = ["Strength", "Intelligence", "Willpower", "Agility", "Endurance"];
const FirstColorSubtype = 9;
const UnknownCard = "unknown";
const KeywordAttributes = [28, 29, 30, 31, 46, 47, 48, 70];
const KeywordEnum = ["Charge", "Taunt", "Cover", "Deathtouch", "Breakthrough", "Ward", "Regenerate", "Drain"];
const KeywordShown = ["Charge", "Guard", "Cover", "Lethal", "Breakthrough", "Ward", "Regenerate", "Drain"];
const AttrManaCost = 22, AttrAttack = 24, AttrMaxHealth = 25;
const StatBuffText = /\+(\d+)\/\+(\d+)/;
const CostChangeText = /costs?\s+(\d+)\s+(more|less)|([+-])(\d+)\s+(?:magicka\s+)?cost|(increase|raise|reduce|decrease|lower)s?\s+(?:its|their|the)?\s*cost\s+by\s+(\d+)/i;

const inc = <K>(m: Map<K, number>, k: K, by = 1) => m.set(k, (m.get(k) ?? 0) + by);
const ordinal = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export class Tracker {
  readonly lines: string[] = [];
  private cards: Cards;
  private settings: TrackerSettings;

  // deck
  deckRows: OverlayRow[] | null = null;
  rowById: Map<string, OverlayRow> | null = null;
  loadedDeckName = "";
  private trackedTotal = 0;
  private myCreatedRows: OverlayRow[] = [];
  private oppRows: OverlayRow[] = [];
  private currentVersion = "";

  // events
  private uidZone = new Map<number, number>();
  private uidKey = new Map<number, string>();
  private drawnUid = new Map<number, string>();
  private unknownLeftUid = new Map<number, boolean>();
  private unknownLeftZone = new Map<number, number>();
  private viewFromDeck = new Map<number, boolean>();
  private unknownEntered = 0;
  serverDeckCount = -1;
  private lastEventsDiff = Number.MIN_SAFE_INTEGER;
  private maxEventsDiff = 0; private eventsDiffChanges = 0;
  private cardIds = new Map<number, number>();
  private opponentSeen = new Map<string, boolean>();
  private plays: [number, number][] = [];
  private nonDeckUid = new Map<number, boolean>();
  private uidOwner = new Map<number, number>();
  private opponentCreated = new Map<string, number>();
  private myCreated = new Map<string, number>();
  private myBanished = new Map<string, number>();
  private oppBanished = new Map<string, number>();
  private banishedUid = new Map<number, boolean>();
  private goneUid = new Map<number, boolean>();
  private firstCardId = new Map<number, number>();
  private copyUid = new Map<number, boolean>();
  private avatarUid = new Map<number, boolean>();
  private changedSeen = new Map<string, boolean>();
  private headerActor = 0;
  private queueStartCount = -1; private ownLeftInQueue = 0; private ownEnteredInQueue = 0;
  private oppFromDeck: [number, number, string][] = [];
  private queueTrace: string[] = [];
  private diedToDiscard = new Map<string, number>();
  private diedToDeathrattle = new Map<string, number>();
  private traceDumps = 0;
  private deckMods = new Map<number, string>();
  private pastHistoryQueue: any = null;
  private replayingPast = false;
  private opponentUid = 0;
  private opponentName = "";
  private opponentHuman = false;
  private opponentAiId = 0;
  private opponentColors: string[] = [];
  private firstPlayer = 0; private turnStarts = 0;
  private resumed = false;
  private debugCommands = new Map<string, number>();
  private liveEventsSeen = false;
  private incrementalState = false;
  private headerSeq = 0;
  private buffedBy = new Map<number, number>();
  private reconciled = 0; private fakeUnknownUid = 0;
  private fullStateInQueue = false;
  private syncAfterState = false;
  private serverCountVersion = 0; private stateCountVersion = 0;
  private selfReturnLevel = new Map<number, number>();
  private selfReturnsByKey = new Map<string, number>();
  private ownCost = new Map<number, number>();
  private oppBackToHand = new Map<string, number>();
  private oppBackToHandUid = new Map<number, boolean>();
  private graveyardIssue = "";
  gameEnded = false;

  // opponent window
  private oppDeck: Map<string, number> | null = null;
  private oppDeckName = "";

  // snapshots
  private lastSnapshot: Map<string, string>[] = [new Map(), new Map()];

  // the window settings can change during a match (the phone's settings panel)
  setSettings(s: Partial<TrackerSettings>) { this.settings = { ...this.settings, ...s }; }

  setLocal(local: number) { if (local > 0) this.local = local; }

  // a full state in this queue pointed at a past history (the live adapter compares the Il2Cpp objects instead)
  get expectsPastHistory() { return this.pastHistoryQueue != null; }

  constructor(private env: TrackerEnv, private local: number) {
    this.cards = env.cards;
    this.settings = { showLeft: false, countLeftOnly: false, artVersions: false, ...(env.settings ?? {}) };
  }

  log(line: string) { this.lines.push(line); this.env.log?.(line); }
  private label(key: string) { return this.cards.label(key); }
  private keyOf(cardId: number) { return this.cards.keyOf(cardId); }

  // ---- deck rows (MatchTracker.Deck.cs) ----

  // The match deck as base card -> copies (LoadDeckRows with the replay's recorded deck).
  loadDeck(cards: Map<string, number>, name: string) {
    const rows: OverlayRow[] = [], byId = new Map<string, OverlayRow>();
    for (const [id, count] of cards) {
      if (count <= 0) continue;
      const meta = this.cards.meta(id);
      const baseId = meta ? meta.BaseId : id;
      let row = byId.get(baseId);
      if (!row) { row = this.newRow(baseId, meta && meta.Name.length > 0 ? meta.Name : id, meta); byId.set(baseId, row); rows.push(row); }
      row.Total += count; row.Start += count;
    }
    sortRows(rows);
    this.deckRows = rows;
    this.rowById = byId;
    this.loadedDeckName = name;
    this.resetEvents();
    this.publish();
  }

  private newRow(id: string, name: string, meta: CardMeta | null): OverlayRow {
    const row = new OverlayRow();
    row.Id = id; row.Name = name;
    if (meta) { row.Color = meta.Color; row.Cost = meta.Cost; row.Category = meta.Category; row.Unique = meta.Unique; row.Prophecy = meta.Prophecy; }
    else {
      const info = this.cards.info(id);
      if (info) {
        row.Cost = info.Cost;
        row.Color = info.Colors;
        row.Category = info.Type.startsWith("Creature") ? 0 : info.Type.startsWith("Item") ? 3 : info.Type.startsWith("Support") ? 2 : 1;
      }
    }
    return row;
  }

  private addRow(id: string, name: string, meta: CardMeta | null): OverlayRow {
    const row = this.newRow(id, name, meta);
    this.rowById!.set(id, row);
    this.deckRows!.push(row);
    sortRows(this.deckRows!);
    return row;
  }

  private versionLeft(row: OverlayRow, delta: number) {
    if (row.Versions.size === 0) return;
    let pick: string | null = null;
    const count = row.Versions.get(this.currentVersion);
    if (count !== undefined) {
      const drawn = row.VersionDrawn.get(this.currentVersion) ?? 0;
      if (delta > 0 ? drawn < count : drawn > 0) pick = this.currentVersion;
    }
    if (pick == null)
      for (const [k, v] of row.Versions) {
        const drawn = row.VersionDrawn.get(k) ?? 0;
        if (delta > 0 ? drawn < v : drawn > 0) { pick = k; break; }
      }
    if (pick == null) return;
    row.VersionDrawn.set(pick, (row.VersionDrawn.get(pick) ?? 0) + delta);
  }

  publish() {
    if (!this.deckRows) return;
    this.publishDeckMods();
    const capped = this.unknownLeftUid.size > 0 && this.serverDeckCount >= 0;
    let sure = 0;
    if (capped) for (const row of this.deckRows) sure += Math.min(row.Sure, row.RawRemaining);
    const cap = capped ? Math.max(0, this.serverDeckCount - sure) : Number.MAX_SAFE_INTEGER;
    let remaining = 0;
    for (const row of this.deckRows) {
      row.Cap = capped ? Math.min(row.Sure, row.RawRemaining) + cap : Number.MAX_SAFE_INTEGER;
      remaining += row.RawRemaining;
    }
    this.trackedTotal = remaining;
    const created: OverlayRow[] = [];
    for (const [key, n] of this.myCreated) {
      const row = this.newRow(key, this.label(key), this.cards.meta(key));
      row.Total = row.Drawn = n; row.Start = -1;
      created.push(row);
    }
    sortRows(created);
    this.myCreatedRows = created;
  }

  // ---- events (MatchTracker.Events.cs) ----

  private resetCardEvents() {
    for (const m of [this.uidZone, this.uidKey, this.drawnUid, this.unknownLeftUid, this.unknownLeftZone, this.viewFromDeck, this.deckMods,
      this.selfReturnLevel, this.selfReturnsByKey, this.ownCost, this.buffedBy, this.cardIds, this.opponentSeen, this.oppBackToHand,
      this.oppBackToHandUid, this.nonDeckUid, this.uidOwner, this.opponentCreated, this.myCreated, this.myBanished, this.oppBanished,
      this.banishedUid, this.goneUid, this.firstCardId, this.copyUid, this.avatarUid, this.changedSeen] as Map<any, any>[]) m.clear();
    this.unknownEntered = 0;
    this.reconciled = 0;
    this.lastEventsDiff = Number.MIN_SAFE_INTEGER;
    this.maxEventsDiff = this.eventsDiffChanges = this.traceDumps = 0;
    this.graveyardIssue = "";
    this.plays = [];
    this.headerActor = 0;
  }

  resetEvents() {
    this.resetCardEvents();
    this.lastSnapshot = [new Map(), new Map()];
    this.serverDeckCount = -1;
    this.opponentUid = 0; this.opponentName = ""; this.opponentHuman = false; this.opponentAiId = 0;
    this.opponentColors = [];
    this.firstPlayer = this.turnStarts = 0;
    this.resumed = false;
    this.liveEventsSeen = false;
    this.oppDeck = null; this.oppDeckName = "";
    this.oppRows = [];
  }

  // isPast: the live adapter's verdict that this queue is the reconnect's past history (same object as the full state's
  // HistoryQueue); without it the object identity decides, which a replay never matches (like the PC replay).
  processQueue(queue: any, isPast?: boolean) {
    const local = this.local;
    if (local <= 0) { this.log("Events: local player id unknown"); return; }
    this.queueStartCount = this.serverDeckCount;
    this.ownLeftInQueue = this.ownEnteredInQueue = 0;
    this.oppFromDeck = [];
    this.queueTrace = [];
    this.diedToDiscard.clear();
    this.diedToDeathrattle.clear();
    this.replayingPast = isPast ?? (this.pastHistoryQueue != null && queue === this.pastHistoryQueue);
    if (this.replayingPast) {
      this.pastHistoryQueue = null;
      this.log("Events: history before the reconnect, already in the game state (own deck not recounted)");
      try { this.processQueueItems(queue, local); } finally { this.replayingPast = false; this.oppFromDeck = []; }
      return;
    }
    this.processQueueItems(queue, local);
    let drop = this.queueStartCount >= 0 && this.serverDeckCount >= 0 ? this.queueStartCount - this.serverDeckCount - this.ownLeftInQueue + this.ownEnteredInQueue : 0;
    if (this.fullStateInQueue) drop = 0;
    if (drop !== 0 && this.oppFromDeck.length === 0 && this.traceDumps < 20) {
      this.traceDumps++;
      this.log(`Events: server deck changed by ${this.serverDeckCount - this.queueStartCount} but we saw ${this.ownLeftInQueue} left / ${this.ownEnteredInQueue} entered; card events: ${this.queueTrace.join("; ")}`);
    }
    this.resolveStolenFromDeck(local);
    if (drop !== 0 && this.oppFromDeck.length === 0) this.reconcile(drop);
    if (!this.fullStateInQueue) this.liveEventsSeen = true;
    this.fullStateInQueue = false;
    // The past history of a reconnect (FullGameState.HistoryQueue) reaches AddHistoryQueue as its own message; live, the
    // adapter passes that same object, so `queue === pastHistoryQueue` spots it. A replay decodes every chunk anew and
    // never matches, exactly like the PC replay (ParseFrom gives new objects).
  }

  private reconcile(drop: number) {
    this.reconciled += Math.abs(drop);
    if (drop < 0) {
      this.unknownEntered += -drop;
      this.log(`Events: ${-drop} card(s) entered the deck without an event, counted as unknown`);
      return;
    }
    for (let i = 0; i < drop; i++) {
      const fake = --this.fakeUnknownUid;
      this.unknownLeftUid.set(fake, true);
      this.unknownLeftZone.set(fake, -1);
    }
    this.log(`Events: ${drop} card(s) left the deck without an event, counted as unknown`);
  }

  private processQueueItems(queue: any, local: number) {
    for (const item of queue?.Queue ?? []) {
      if (!item) continue;
      const type = item.Type;
      if (type === TypeFullGameState && this.replayingPast) { this.log("Events: old game state in the reconnect history skipped"); continue; }
      if (type === TypeFullGameState) { this.applyFullGameState(item.FullGameState, local); continue; }
      for (const player of item.MatchIntroPlayers ?? []) if (player) this.onIntroPlayer(player, local);
      const acting = item.ActingPlayerInstanceId;
      if (type === TypeTurnStart && !this.replayingPast) {
        this.turnStarts++;
        if (this.firstPlayer === 0) this.firstPlayer = acting;
      } else if (type === TypePlayCard) this.plays.push([acting, item.ActorCardNetUid]);
      for (const player of item.AffectedPlayersArray ?? []) {
        if (!player || !player.ValidDeckCount) continue;
        if (player.PlayerUid === local) { this.serverDeckCount = player.DeckCardCount; this.serverCountVersion++; }
      }
      if (type >= 10000 && type < 20000) { this.headerActor = item.ActorCardNetUid; this.headerSeq++; }
      else if (type === 20000) this.headerActor = 0;
      const typeName = String(type);
      for (const card of item.AffectedCardsArray ?? []) if (card) this.onHistoryCard(card, type, typeName, local);
      if (type === TypeGameEnd && !this.replayingPast) this.onGameEnd();
    }
  }

  private onIntroPlayer(player: any, local: number) {
    const uid = player.PlayerInstanceId;
    if (uid === 0 || uid === local) return;
    this.opponentUid = uid;
    this.opponentName = player.PlayerName ?? "";
    this.opponentHuman = !!player.IsHuman;
    this.opponentAiId = player.AiOpponentId;
    this.opponentColors = [];
    for (const value of player.DeckColorNames ?? []) {
      const index = value - FirstColorSubtype;
      if (index >= 0 && index < SubtypeColors.length && !this.opponentColors.includes(SubtypeColors[index])) this.opponentColors.push(SubtypeColors[index]);
    }
    this.opponentColors.sort(ordinal);
    this.onOpponentKnown();
    this.log(`Events: opponent '${this.opponentName}' (${this.opponentHuman ? "human" : "AI"}) colors ${this.opponentColors.join("/")}`);
  }

  private onHistoryCard(card: any, type: number, typeName: string, local: number) {
    const uid: number = card.CardNetUid;
    const position = card.CurrentPosition;
    if (uid === 0 || !position) return;
    const owner: number = position.OwningPlayerUid;
    const zone: number = position.GameZoneName;
    const cardId: number = card.CardId;
    if (cardId !== 0) this.cardIds.set(uid, cardId);
    if (this.queueTrace.length < 40)
      this.queueTrace.push(`${typeName} uid=${uid} owner=${owner === local ? "me" : owner} zone=${zone} prev=${card.PreviousGameZoneType} card=${cardId !== 0 ? this.label(this.keyOf(cardId)) : "?"} creator=${card.CreatorCardId}`);

    if (zone === ZoneAvatarBoard || zone === ZoneAvatarDeck || zone === ZoneAvatarCemetery || zone === ZoneHeroPowerBoard) { this.avatarUid.set(uid, true); return; }
    if (this.avatarUid.has(uid)) return;
    if (cardId !== 0) {
      const avatarInfo = this.cards.info(String(cardId));
      if (avatarInfo && (avatarInfo.Avatar || avatarInfo.Name === "Avatar")) { this.avatarUid.set(uid, true); return; }
    }
    if (zone === ZoneRemoveFromGame && !this.banishedUid.has(uid)) {
      this.banishedUid.set(uid, true);
      const banished = cardId !== 0 ? this.keyOf(cardId) : UnknownCard;
      inc(owner === local ? this.myBanished : this.oppBanished, banished);
      this.log(`Events: banished ${owner === local ? "own " : "opponent "}${this.label(banished)} uid=${uid} (${typeName})`);
    }

    let changed = false;
    if (cardId !== 0) {
      const firstId = this.firstCardId.get(uid);
      if (firstId === undefined) {
        this.firstCardId.set(uid, cardId);
        const actorId = this.cardIds.get(this.headerActor);
        if (this.headerActor !== 0 && this.headerActor !== uid && this.nonDeckUid.has(this.headerActor) && actorId === cardId) this.nonDeckUid.set(uid, true);
      } else if (firstId !== cardId) changed = true;
    }

    const creator: number = card.CreatorCardId;
    const previousOwner = this.uidOwner.get(uid);
    const stolen = previousOwner !== undefined && previousOwner !== owner;
    this.uidOwner.set(uid, owner);
    if (creator !== 0 || stolen || changed || type === TypeTransformCard || type === TypeChangeCard || this.nonDeckUid.has(uid)) {
      const first = !this.nonDeckUid.has(uid);
      this.nonDeckUid.set(uid, true);
      const count = cardId !== 0 && (first && (type === TypeCreateToken || stolen || type === TypeTransformCard || type === TypeChangeCard) ||
        changed && !this.changedSeen.has(`${uid}:${cardId}`));
      if (changed) this.changedSeen.set(`${uid}:${cardId}`, true);
      const how = `${typeName}${stolen ? ", stolen" : changed ? ", changed" : ""}`;
      if (owner !== local) {
        if (count) {
          const created = this.keyOf(cardId);
          inc(this.opponentCreated, created);
          this.log(`Events: opponent non-deck card ${this.label(created)} uid=${uid} (${how})`);
        }
        if (stolen && previousOwner === local) {
          const mine = this.uidKey.get(uid);
          if (mine !== undefined) this.markGone(uid, mine, "stolen by the opponent");
        }
        return;
      }
      if (count) {
        const created = this.keyOf(cardId);
        inc(this.myCreated, created);
        this.log(`Events: own non-deck card ${this.label(created)} uid=${uid} (${how})`);
      }
    }

    if (owner !== local) {
      const previousZoneType: number = card.PreviousGameZoneType;
      if (zone === ZoneHand && cardId !== 0 && type !== TypeFullGameState && !this.replayingPast && previousZoneType !== 0 &&
          (previousZoneType & ZoneTypeDeck) === 0 && !this.oppBackToHandUid.has(uid)) {
        this.oppBackToHandUid.set(uid, true);
        const back = this.keyOf(cardId);
        inc(this.oppBackToHand, back);
        this.log(`Events: opponent card ${this.label(back)} uid=${uid} back to hand (${typeName}, from zone type ${previousZoneType})`);
      }
      if (cardId !== 0 && type !== TypeFullGameState && !this.replayingPast && (card.PreviousGameZoneType & ZoneTypeDeck) !== 0) {
        this.oppFromDeck.push([uid, cardId, typeName]);
        return;
      }
      if (cardId !== 0) {
        const seen = this.keyOf(cardId);
        if (!this.opponentSeen.has(seen)) {
          this.opponentSeen.set(seen, true);
          this.log(`Events: opponent card ${this.label(seen)} uid=${uid} (${typeName})`);
        }
      }
      return;
    }
    if (this.replayingPast) return;
    this.rememberCost(card, uid);

    let key: string | undefined;
    if (cardId !== 0 && !changed) {
      key = this.keyOf(cardId);
      this.uidKey.set(uid, key);
      if (this.unknownLeftUid.delete(uid)) { this.unknownLeftZone.delete(uid); this.markLeft(uid, key, "identified later"); }
    } else key = this.uidKey.get(uid);

    const lastZone = this.uidZone.get(uid);
    const known = lastZone !== undefined;
    const wasInDeck = known
      ? lastZone === ZoneDeck || (lastZone === ZoneView && this.viewFromDeck.has(uid))
      : (card.PreviousGameZoneType & ZoneTypeDeck) !== 0 || type === TypeDrawForMulligan || type === TypeRedrawForMulligan ||
        (type === TypeFullGameState && creator === 0 && !this.incrementalState);
    const inDeck = zone === ZoneDeck || (zone === ZoneView && wasInDeck);
    if (zone === ZoneView && wasInDeck) this.viewFromDeck.set(uid, true); else this.viewFromDeck.delete(uid);
    if (type === TypeFullCardRefresh && (!known || lastZone === zone)) {
      this.uidZone.set(uid, zone);
      if (inDeck && key !== undefined) this.readDeckMods(card, uid, key, type, typeName, false);
      return;
    }
    this.uidZone.set(uid, zone);
    if (inDeck && key !== undefined) this.readDeckMods(card, uid, key, type, typeName, !wasInDeck);

    if (zone === ZoneRemoveFromGame && creator === 0 && !this.nonDeckUid.has(uid) && key !== undefined) this.markGone(uid, key, "banished");

    if (wasInDeck && !inDeck && key !== undefined && (zone === ZoneDeathrattle || type === TypeAddToDiscard) && this.secondDeathFromDeck(key, zone === ZoneDeathrattle)) {
      this.log(`Events: ${this.label(key)} uid=${uid} (${typeName}) is the same card destroyed in the deck, not counted again`);
      return;
    }
    if (wasInDeck && !inDeck) this.ownLeftInQueue++;
    else if (!wasInDeck && inDeck) this.ownEnteredInQueue++;
    const fullRow = key !== undefined ? this.rowById!.get(key) : undefined;
    if (wasInDeck && !inDeck && type === TypeFullGameState && key !== undefined && fullRow && fullRow.Drawn >= fullRow.Total) {
      this.nonDeckUid.set(uid, true);
      inc(this.myCreated, key);
      this.log(`Events: own ${this.label(key)} uid=${uid} counted as a copy (more outside the deck than in the deck list)`);
      return;
    }
    this.currentVersion = `${cardId}|${card.IsPremium ? "1" : "0"}`;
    if (wasInDeck && !inDeck) {
      if (key !== undefined && type !== TypeFullGameState) this.verifyPrediction(card, key, zone === ZoneHand ? "drawn" : "left the deck");
      if (key !== undefined) this.markLeft(uid, key, `${typeName} -> ${position.GameZoneName}`, creator !== 0);
      else {
        this.unknownLeftUid.set(uid, true);
        this.unknownLeftZone.set(uid, zone);
        for (const r of this.deckRows!) r.Sure = 0;
        this.log(`Events: unknown card left the deck uid=${uid} (${typeName} -> ${zone})`);
      }
    } else if (!wasInDeck && inDeck) {
      if (!known && key === undefined && this.turnStarts === 0) return;
      this.enteredDeck(uid, key, typeName, card.CreatorCardId);
    }
  }

  private rememberCost(card: any, uid: number) {
    const names: number[] = card.AffectedAttributeName ?? [], values: number[] = card.AffectedAttributeValue ?? [];
    if (names.length !== values.length) return;
    for (let i = 0; i < names.length; i++) if (names[i] === AttrManaCost) { this.ownCost.set(uid, values[i]); return; }
  }

  private readDeckMods(card: any, uid: number, key: string, type: number, typeName: string, entering: boolean) {
    const names: number[] = card.AffectedAttributeName ?? [], values: number[] = card.AffectedAttributeValue ?? [];
    if (names.length === 0 || names.length !== values.length) {
      const buff = type === 30016 || type === 30079 || type === 30048 || type === 30083;
      if (!buff && !(entering && type !== TypeCreateToken && type !== TypeFullGameState)) return;
      const actorId = this.cardIds.get(this.headerActor);
      if (this.headerActor === 0 || actorId === undefined) return;
      const actor = this.cards.info(String(actorId));
      if (!actor) return;
      const text = actor.Text.replace(/<[^>]+>/g, "");
      const self = this.keyOf(actorId) === key;
      if (self && (!entering || text.toLowerCase().indexOf("deck") < 0)) return;
      const m = StatBuffText.exec(text);
      const c = self ? CostChangeText.exec(text) : null;
      if (!m && !c) {
        if (entering) this.log(`Events: deck card ${this.label(key)} uid=${uid} entered via ${actor.Name} (${typeName}), no change found in its text`);
        return;
      }
      let costDelta = 0;
      if (c) {
        if (c[1] !== undefined) costDelta = Number(c[1]) * (c[2].toLowerCase() === "less" ? -1 : 1);
        else if (c[4] !== undefined) costDelta = Number(c[4]) * (c[3] === "-" ? -1 : 1);
        else { const verb = c[5].toLowerCase(); costDelta = Number(c[6]) * (verb === "increase" || verb === "raise" ? 1 : -1); }
      }
      let level = 1;
      if (self) {
        let prev = -1;
        const baseCostNow = this.cards.baseAttribute(key, "ManaCost");
        const lastCost = this.ownCost.get(this.headerActor);
        if (costDelta !== 0 && baseCostNow >= 0 && lastCost !== undefined) prev = Math.max(0, Math.trunc((lastCost - baseCostNow) / costDelta));
        const saved = this.selfReturnLevel.get(this.headerActor);
        if (prev < 0 && saved !== undefined) prev = saved;
        const selfRow = this.rowById!.get(key);
        if (prev < 0 && selfRow && selfRow.Total - selfRow.Copies <= 1) prev = this.selfReturnsByKey.get(key) ?? 0;
        level = Math.max(0, prev) + 1;
        this.selfReturnLevel.set(uid, level);
        this.selfReturnsByKey.set(key, level);
      }
      const found: string[] = [];
      if (c) {
        const baseCostNow = this.cards.baseAttribute(key, "ManaCost");
        if (baseCostNow >= 0) found.push(`cost ${Math.max(0, baseCostNow + costDelta * level)}`);
      }
      if (m) found.push(`+${Number(m[1]) * level}/+${Number(m[2]) * level}`);
      let inferred = found.join(", ");
      if (self) {
        if (this.deckMods.get(uid) === inferred) return;
        this.deckMods.set(uid, inferred);
      } else {
        if (this.buffedBy.get(uid) === this.headerSeq) return;
        this.buffedBy.set(uid, this.headerSeq);
        this.deckMods.set(uid, addStats(this.deckMods.get(uid), inferred));
        inferred = this.deckMods.get(uid)!;
      }
      this.log(`Events: deck card ${this.label(key)} uid=${uid} modified: ${inferred} (from the text of ${actor.Name}, ${typeName}${self ? `, return ${level}` : ""})`);
      return;
    }
    const label = this.attributeLabel(names, values, key);
    if (this.deckMods.get(uid) === label) return;
    if (label.length === 0) { this.deckMods.delete(uid); return; }
    this.deckMods.set(uid, label);
    this.log(`Events: deck card ${this.label(key)} uid=${uid} modified: ${label}`);
  }

  private attributeLabel(names: number[], values: number[], id: string): string {
    const attributes = new Map<number, number>();
    for (let i = 0; i < names.length; i++) attributes.set(names[i], values[i]);
    const parts: string[] = [];
    const baseCost = this.cards.baseAttribute(id, "ManaCost");
    const cost = attributes.get(AttrManaCost);
    if (cost !== undefined && baseCost >= 0 && cost !== baseCost) parts.push(`cost ${cost}`);
    const baseAttack = this.cards.baseAttribute(id, "Attack"), baseHealth = this.cards.baseAttribute(id, "MaxHealth");
    let attack = attributes.get(AttrAttack), health = attributes.get(AttrMaxHealth);
    if ((attack !== undefined || health !== undefined) && baseAttack >= 0 && baseHealth >= 0) {
      if (attack === undefined) attack = baseAttack;
      if (health === undefined) health = baseHealth;
      if (attack !== baseAttack || health !== baseHealth)
        parts.push(`${attack - baseAttack >= 0 ? "+" : ""}${attack - baseAttack}/${health - baseHealth >= 0 ? "+" : ""}${health - baseHealth}`);
    }
    for (let k = 0; k < KeywordAttributes.length; k++) {
      const value = attributes.get(KeywordAttributes[k]);
      if (value !== undefined && value > 0 && !this.cards.baseFlag(id, KeywordEnum[k])) parts.push(KeywordShown[k]);
    }
    return parts.join(", ");
  }

  private verifyPrediction(card: any, key: string, how: string) {
    const names: number[] = card.AffectedAttributeName ?? [], values: number[] = card.AffectedAttributeValue ?? [];
    // the PC sees null lists only when the fields are missing; a decoded message always has (maybe empty) arrays
    if (names.length !== values.length) {
      const predicted = this.predictedDeckUids(key);
      const r = this.rowById!.get(key);
      const left = r ? r.RawRemaining - 1 : 0;
      if (predicted.length > 0 && predicted.length > left) this.uidZone.set(predicted[0], ZoneHand);
      return;
    }
    const actual = modCore(this.attributeLabel(names, values, key));
    const modified = this.predictedDeckUids(key);
    let matched = 0;
    for (const u of modified) if (modCore(this.deckMods.get(u)) === actual) { matched = u; break; }
    const row = this.rowById!.get(key);
    const remaining = row ? row.RawRemaining : 0;
    if (matched !== 0) {
      this.uidZone.set(matched, ZoneHand);
      this.log(`MODCHECK ok: ${this.label(key)} ${how} as '${actual}' as predicted (deck uid ${matched})`);
      return;
    }
    if (actual.length === 0) {
      if (modified.length > 0 && modified.length >= remaining)
        this.log(`MODCHECK MISMATCH: ${this.label(key)} ${how} unmodified, predicted only ${this.predictedLabels(modified)}`);
      return;
    }
    this.log(`MODCHECK MISMATCH: ${this.label(key)} ${how} as '${actual}', predicted ${modified.length > 0 ? this.predictedLabels(modified) : "no change"}`);
    if (modified.length > 0) this.uidZone.set(modified[0], ZoneHand);
  }

  private predictedDeckUids(key: string): number[] {
    const uids: number[] = [];
    for (const [uid, zone] of this.uidZone) {
      const mod = this.deckMods.get(uid);
      if (zone === ZoneDeck && this.uidKey.get(uid) === key && mod !== undefined && modCore(mod).length > 0) uids.push(uid);
    }
    return uids;
  }

  private predictedLabels(uids: number[]): string { return uids.map(u => `'${modCore(this.deckMods.get(u))}'`).join(", "); }

  private publishDeckMods() {
    const byRow = this.deckModsByRow();
    for (const row of this.deckRows!) {
      const counts = byRow.get(row.Id);
      row.Mods = counts ? [...counts].map(([label, n]) => `${n}x ${label}`).join("; ") : "";
    }
  }

  private deckModsByRow(): Map<string, Map<string, number>> {
    const byRow = new Map<string, Map<string, number>>();
    for (const [uid, label] of this.deckMods) {
      const key = this.uidKey.get(uid);
      if (this.uidZone.get(uid) !== ZoneDeck || key === undefined) continue;
      let counts = byRow.get(key);
      if (!counts) byRow.set(key, counts = new Map());
      inc(counts, label);
    }
    return byRow;
  }

  private secondDeathFromDeck(key: string, deathrattle: boolean): boolean {
    const other = deathrattle ? this.diedToDiscard : this.diedToDeathrattle;
    const mine = deathrattle ? this.diedToDeathrattle : this.diedToDiscard;
    const n = other.get(key) ?? 0;
    if (n > 0) { other.set(key, n - 1); return true; }
    inc(mine, key);
    return false;
  }

  private resolveStolenFromDeck(_local: number) {
    if (this.oppFromDeck.length === 0) return;
    let stolen = this.queueStartCount >= 0 && this.serverDeckCount >= 0 ? this.queueStartCount - this.serverDeckCount - this.ownLeftInQueue + this.ownEnteredInQueue : 0;
    this.oppFromDeck.sort((a, b) => this.inOurDeck(b[1]) - this.inOurDeck(a[1]));
    for (const [uid, cardId, typeName] of this.oppFromDeck) {
      const key = this.keyOf(cardId);
      if (stolen > 0 && this.inOurDeck(cardId) > 0) {
        stolen--;
        this.nonDeckUid.set(uid, true);
        inc(this.opponentCreated, key);
        this.markLeft(uid, key, "stolen from the deck by the opponent");
        this.markGone(uid, key, "stolen from the deck");
        continue;
      }
      if (!this.opponentSeen.has(key)) {
        this.opponentSeen.set(key, true);
        this.log(`Events: opponent card ${this.label(key)} uid=${uid} (${typeName}, from the deck)`);
      }
    }
    if (stolen > 0) this.log(`Events: ${stolen} card(s) left our deck to the opponent without a known identity`);
    this.oppFromDeck = [];
  }

  private inOurDeck(cardId: number): number { return this.rowById?.get(this.keyOf(cardId))?.RawRemaining ?? 0; }

  private markGone(uid: number, key: string, how: string) {
    if (this.goneUid.has(uid)) return;
    this.goneUid.set(uid, true);
    const row = this.rowById!.get(key);
    if (!row) return;
    if (row.Gone < row.Total) row.Gone++;
    this.log(`Events: x ${this.label(key)} uid=${uid} (${how}), gone ${row.Gone}/${row.Total}`);
  }

  private markLeft(uid: number, key: string, how: string, copy = false) {
    let row = this.rowById!.get(key);
    if (!row) {
      if (this.unknownEntered === 0) {
        this.log(`Events: ignored ${this.label(key)} uid=${uid} (${how}): not in the deck list`);
        if (this.ownLeftInQueue > 0) this.ownLeftInQueue--;
        return;
      }
      row = this.addRow(key, this.label(key), this.cards.meta(key));
      row.Total++;
      if (this.unknownEntered > 0) this.unknownEntered--;
    }
    row.Drawn++;
    this.versionLeft(row, 1);
    if (row.Sure > 0) row.Sure--;
    if ((copy || this.copyUid.has(uid)) && row.Copies > 0) row.Copies--;
    if (row.Copies > row.RawRemaining) row.Copies = row.RawRemaining;
    this.drawnUid.set(uid, key);
    this.log(`Events: - ${this.label(key)} uid=${uid} (${how}) now ${row.RawRemaining}/${row.Total}`);
  }

  private enteredDeck(uid: number, key: string | undefined, typeName: string, creator: number) {
    const drawnKey = this.drawnUid.get(uid);
    if (drawnKey !== undefined) {
      this.drawnUid.delete(uid);
      const back = this.rowById!.get(drawnKey);
      if (back && back.Drawn > 0) {
        back.Drawn--;
        this.versionLeft(back, -1);
        if (this.unknownLeftUid.size > 0) back.Sure++;
        if (this.copyUid.has(uid)) back.Copies++;
      }
      this.log(`Events: + returned ${this.label(drawnKey)} uid=${uid} (${typeName})${back ? ` now ${back.RawRemaining}/${back.Total}` : ""}`);
      return;
    }
    if (key === undefined) {
      this.unknownEntered++;
      this.log(`Events: + unknown card entered the deck uid=${uid} (${typeName})`);
      return;
    }
    let row = this.rowById!.get(key);
    if (creator === 0 && row && row.Drawn > 0) {
      row.Drawn--;
      this.versionLeft(row, -1);
      if (this.unknownLeftUid.size > 0) row.Sure++;
      this.log(`Events: + returned ${this.label(key)} uid=${uid} (${typeName}, new uid) now ${row.RawRemaining}/${row.Total}`);
      return;
    }
    if (!row) row = this.addRow(key, this.label(key), this.cards.meta(key));
    row.Total++;
    if (this.unknownLeftUid.size > 0) row.Sure++;
    row.Copies++;
    this.copyUid.set(uid, true);
    this.log(`Events: + shuffled in ${this.label(key)} uid=${uid} (${typeName}) now ${row.RawRemaining}/${row.Total}`);
  }

  private stateCards(state: any): any[] {
    const out: any[] = [];
    for (const player of state?.PlayerStates ?? [])
      for (const zones of [player.StaticGameZones, player.DynamicGameZones])
        for (const zone of zones ?? [])
          for (const lane of zone.Lanes ?? [])
            for (const card of lane.Cards ?? []) if (card) out.push(card);
    return out;
  }

  private applyFullGameState(state: any, local: number) {
    if (!state) return;
    if (this.liveEventsSeen && this.debugCommands.size > 0) {
      this.pastHistoryQueue = state.HistoryQueue;
      this.fullStateInQueue = true;
      this.syncAfterState = true;
      this.stateCountVersion = this.serverCountVersion;
      let seenCards = 0;
      this.incrementalState = true;
      try { for (const card of this.stateCards(state)) { this.onHistoryCard(card, TypeFullGameState, "FullGameState", local); seenCards++; } }
      finally { this.incrementalState = false; }
      this.publish();
      this.log(`Events: full game state during the match (${seenCards} cards), checked against the tracking, deck not recounted`);
      return;
    }
    const keep: OverlayRow[] = [];
    for (const row of this.deckRows!) {
      if (row.Start <= 0) { this.rowById!.delete(row.Id); continue; }
      row.Total = row.Start; row.Drawn = 0; row.Gone = 0; row.Copies = 0;
      keep.push(row);
    }
    this.deckRows = keep;
    this.resetCardEvents();
    if (!state.DuringMulligan && this.turnStarts === 0) {
      this.turnStarts = 1;
      if (this.firstPlayer === 0) { this.resumed = true; this.firstPlayer = -1; }
    }
    this.pastHistoryQueue = state.HistoryQueue;
    this.fullStateInQueue = true;
    this.syncAfterState = true;
    this.stateCountVersion = this.serverCountVersion;
    let cards = 0, inDeck = 0;
    for (const card of this.stateCards(state)) {
      this.onHistoryCard(card, TypeFullGameState, "FullGameState", local);
      cards++;
      const position = card.CurrentPosition;
      if (position && position.OwningPlayerUid === local && position.GameZoneName === ZoneDeck) inDeck++;
    }
    // RestorePools: a replay never restores the live match's saved pools
    this.publish();
    if (inDeck > this.trackedTotal) {
      this.unknownEntered += inDeck - this.trackedTotal;
      this.log(`Events: ${inDeck - this.trackedTotal} card(s) in the deck not in the deck list (shuffled in before the reconnect)`);
    }
    this.log(`Events: full game state received (${cards} cards, ${inDeck} in our deck), deck recounted from the board`);
  }

  private onGameEnd() {
    // replay: only the check; live recording, stats and upload come with the phone UI (M5)
    if (this.gameEnded) return;
    this.gameEnded = true;
    this.publish();
    this.logWindowSnapshot(true);
    this.logCheck();
  }

  // ---- opponent (MatchTracker.Opponent.cs) ----

  private onOpponentKnown() {
    if (this.opponentHuman) return; // profiles and Reborn history are not part of the core yet
    const lookup = botLookup(this.env.bots, this.opponentAiId, this.env.scenario ?? "");
    if (lookup) {
      this.oppDeck = new Map();
      for (const [id, n] of lookup.cards) {
        const key = /^-?\d+$/.test(id) ? this.keyOf(Number(id)) : id;
        inc(this.oppDeck, key, n);
      }
      this.oppDeckName = lookup.name.length > 0 ? lookup.name : "Bot deck";
      this.log(`Opponent: bot deck from tesl-decks.com: '${this.oppDeckName}' (${this.oppDeck.size} different cards)`);
    }
    this.refreshOpponent();
  }

  private opponentSeenCounts(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const key of this.opponentSeen.keys()) counts.set(key, 1);
    const played = new Map<string, number>();
    const counted = new Set<number>();
    for (const [player, uid] of this.plays) {
      const cardId = this.cardIds.get(uid);
      if (player !== this.opponentUid || this.nonDeckUid.has(uid) || cardId === undefined) continue;
      if (counted.has(uid)) continue;
      counted.add(uid);
      inc(played, this.keyOf(cardId));
    }
    for (const [key, n] of played) {
      const copies = n - (this.oppBackToHand.get(key) ?? 0);
      counts.set(key, Math.max(Math.max(1, copies), counts.get(key) ?? 0));
    }
    return counts;
  }

  refreshOpponent() {
    const seen = this.opponentSeenCounts();
    const rows: OverlayRow[] = [];
    if (this.oppDeck) {
      for (const [key, n] of this.oppDeck) {
        const row = this.newRow(key, this.label(key), this.cards.meta(key));
        row.Total = row.Start = n;
        row.Drawn = Math.min(n, seen.get(key) ?? 0);
        rows.push(row);
      }
      for (const [key, n] of seen) {
        if (this.oppDeck.has(key)) continue;
        const row = this.newRow(key, this.label(key), this.cards.meta(key));
        row.Total = row.Drawn = n; row.Start = 0;
        rows.push(row);
      }
    } else {
      for (const [key, n] of seen) {
        const row = this.newRow(key, this.label(key), this.cards.meta(key));
        row.Total = row.Drawn = n; row.Start = -1;
        rows.push(row);
      }
    }
    sortRows(rows);
    this.oppRows = rows;
  }

  // ---- window contents (Picker.cs DeckEntries, Native.cs WindowEntries) ----

  private countText(left: number, total: number): string {
    if (total <= 1) return "";
    return this.settings.countLeftOnly ? String(left) : `${left}/${total}`;
  }

  // { key, available, mod, label }
  deckEntries(): [string, boolean, string, string][] {
    const mods = this.deckModsByRow();
    const entries: [string, boolean, string, string][] = [];
    for (const row of this.deckRows!) {
      let left = row.Remaining, carved = 0;
      const byLabel = mods.get(row.Id);
      if (byLabel)
        for (const [label, count] of byLabel) {
          const n = Math.min(count, left);
          if (n <= 0) continue;
          entries.push([row.Id, true, label, n > 1 ? String(n) : ""]);
          left -= n; carved += n;
        }
      if (this.settings.artVersions && row.Versions.size > 1) {
        for (const [version, count] of row.Versions) {
          const drawn = row.VersionDrawn.get(version) ?? 0;
          const vLeft = Math.max(0, Math.min(count - drawn, left));
          if (vLeft <= 0 && !this.settings.showLeft) continue;
          entries.push([row.Id, vLeft > 0, "", this.countText(vLeft, count)]);
        }
      } else {
        const total = Math.max(left, row.Total - carved);
        if (total <= 0 || (left <= 0 && !this.settings.showLeft)) continue;
        entries.push([row.Id, left > 0, "", this.countText(left, total)]);
      }
    }
    return entries;
  }

  oppEntries(): [string, boolean, string, string][] {
    const entries: [string, boolean, string, string][] = [];
    for (const row of this.oppRows) {
      if (row.Start > 0) {
        if (row.Remaining <= 0 && !this.settings.showLeft) continue;
        entries.push([row.Id, row.Remaining > 0, "", this.countText(row.Remaining, row.Start)]);
      } else entries.push([row.Id, true, "", row.Total > 1 ? `x${row.Total}` : "seen"]);
    }
    return entries;
  }

  // The cards a window shows as (card id, copies): the deck's remaining copies; the opponent's remaining copies of a
  // known deck, otherwise the cards seen (as often as played). Feeds the game's own card list on the phone.
  // The third value is the label the PC shows in the count's place ("left/total", "x2", "seen"; "" for single copies).
  // Deck: modified copies in the deck ("cost 0", "+5/+5, Guard") come first as their own rows, like DeckEntries on PC
  // (label = their count when more than one), then the plain copies with "left/total" of what is not carved out.
  // The fourth value is the modification ("" for plain copies).
  windowCards(side: "deck" | "opp"): [string, number, string, string][] {
    const out: [string, number, string, string][] = [];
    if (side === "deck") {
      const mods = this.deckModsByRow();
      for (const row of this.deckRows ?? []) {
        let left = row.Remaining, carved = 0;
        for (const [label, count] of mods.get(row.Id) ?? []) {
          const n = Math.min(count, left);
          if (n <= 0) continue;
          out.push([row.Id, n, n > 1 ? String(n) : "", label]);
          left -= n; carved += n;
        }
        const total = Math.max(left, row.Total - carved);
        if (left > 0) out.push([row.Id, left, this.countText(left, total), ""]);
      }
    } else {
      for (const row of this.oppRows) {
        if (row.Start > 0) { if (row.Remaining > 0) out.push([row.Id, row.Remaining, this.countText(row.Remaining, row.Start), ""]); }
        else if (row.Total > 0) out.push([row.Id, row.Total, row.Total > 1 ? `x${row.Total}` : "seen", ""]);
      }
    }
    return out;
  }

  // A modification label as card attributes to set on a shown copy (PC Picker.cs ApplyMods): [attribute id, value].
  modAttributes(id: string, label: string): [number, number][] {
    const out: [number, number][] = [];
    for (const raw of label.split(",")) {
      const part = raw.trim();
      if (part.startsWith("cost ")) out.push([AttrManaCost, Number(part.slice(5))]);
      else if (part.startsWith("+") || part.startsWith("-")) {
        const ah = part.split("/");
        if (ah.length !== 2) continue;
        out.push([AttrAttack, this.cards.baseAttribute(id, "Attack") + Number(ah[0])]);
        out.push([AttrMaxHealth, this.cards.baseAttribute(id, "MaxHealth") + Number(ah[1])]);
      } else {
        const k = KeywordShown.indexOf(part);
        if (k >= 0) out.push([KeywordAttributes[k], 1]);
      }
    }
    return out.filter(([, v]) => Number.isFinite(v));
  }

  // ---- log checks (Replay.cs LogWindowSnapshot, Events.cs LogCheck) ----

  logWindowSnapshot(full: boolean) {
    if (!this.deckRows || !this.rowById) return;
    for (let side = 0; side < 2; side++) {
      const entries = side === 0 ? this.deckEntries() : this.oppEntries();
      const now = new Map<string, string>(), order: string[] = [];
      for (const [key, available, mod, label] of entries) {
        const name = this.label(key) + (mod.length > 0 ? ` [${mod}]` : "");
        let unique = name;
        for (let n = 2; now.has(unique); n++) unique = `${name} #${n}`;
        now.set(unique, (label.length > 0 ? label : "-") + (available ? "" : " grey"));
        order.push(unique);
      }
      const title = side === 0 ? "UI deck" : "UI opp";
      if (full) this.log(`${title} (all ${order.length}): ${order.map(k => `${k} ${now.get(k)}`).join("; ")}`);
      else {
        const before = this.lastSnapshot[side], changes: string[] = [];
        for (const key of order) {
          const old = before.get(key);
          if (old === undefined) changes.push(`+${key} ${now.get(key)}`);
          else if (old !== now.get(key)) changes.push(`${key} ${old}->${now.get(key)}`);
        }
        for (const key of before.keys()) if (!now.has(key)) changes.push(`-${key}`);
        if (before.size === 0 && order.length > 0) this.log(`${title}: ${order.length} rows`);
        else if (changes.length > 0) this.log(`${title}: ${changes.join("; ")}`);
      }
      this.lastSnapshot[side] = now;
    }
  }

  logCheck() {
    const warn: string[] = [], info: string[] = [];
    if (this.deckRows && this.rowById) {
      this.publish();
      const tracked = this.trackedTotal + this.unknownEntered - this.unknownLeftUid.size;
      const final = this.serverDeckCount >= 0 ? tracked - this.serverDeckCount : 0;
      const deck = `deck diff ${final} (max ${this.maxEventsDiff}, ${this.eventsDiffChanges}x)`;
      if (final !== 0 || this.maxEventsDiff > 1) warn.push(deck); else info.push(deck);
      if (this.unknownLeftUid.size > 0) warn.push(`${this.unknownLeftUid.size} unknown left`);
      const bad: string[] = [];
      for (const row of this.deckRows)
        if (row.Drawn > row.Total || row.Copies > row.Total || row.Copies < 0) bad.push(`${row.Name} ${row.Drawn}/${row.Total}+${row.Copies}`);
      if (bad.length > 0) warn.push(`own rows: ${bad.join(", ")}`);
    } else warn.push("no deck loaded");
    if (this.graveyardIssue.length > 0) warn.push(`graveyard: ${this.graveyardIssue}`);
    if (this.reconciled > 0) info.push(`reconciled ${this.reconciled}`);
    const seen = this.opponentSeenCounts();
    const avatar: string[] = [], many: string[] = [], outside: string[] = [];
    for (const [key, n] of seen) {
      const meta = this.cards.meta(key);
      const name = this.label(key);
      if (meta && meta.Avatar || name === "Avatar") avatar.push(name);
      let limit = meta && meta.Unique ? 1 : 3;
      const inDeck = this.oppDeck?.get(key);
      if (inDeck !== undefined) limit = inDeck;
      if (n > limit) many.push(`${name} x${n} (uids ${this.playedUids(key)})`);
      if (this.oppDeck && !this.oppDeck.has(key)) outside.push(name);
    }
    if (avatar.length > 0) warn.push(`opp avatar card: ${avatar.join(", ")}`);
    if (many.length > 0) warn.push(`opp over limit: ${many.join(", ")}`);
    if (outside.length > 0) warn.push(`opp not in their deck '${this.oppDeckName}': ${outside.join(", ")}`);
    info.push(`opp seen ${seen.size}${this.oppDeck ? ` vs deck '${this.oppDeckName}'` : ""}`);
    let created = 0, mine = 0;
    for (const n of this.opponentCreated.values()) created += n;
    for (const n of this.myCreated.values()) mine += n;
    info.push(`created opp ${created} / own ${mine}`);
    if (this.resumed) info.push("resumed");
    if (this.debugCommands.size > 0) info.push(`debug ${[...this.debugCommands].map(([k, n]) => k + (n > 1 ? ` x${n}` : "")).join(", ")}`);
    this.log(`CHECK: ${warn.length === 0 ? "OK" : `WARN ${warn.join(" | ")}`} || ${info.join(" | ")}`);
  }

  private playedUids(key: string): string {
    const uids: string[] = [];
    for (const [player, uid] of this.plays) {
      const cardId = this.cardIds.get(uid);
      if (player === this.opponentUid && cardId !== undefined && this.keyOf(cardId) === key && !uids.includes(String(uid))) uids.push(String(uid));
    }
    return uids.join(",");
  }
}

function sortRows(rows: OverlayRow[]) { rows.sort((a, b) => (a.Cost - b.Cost) || ordinal(a.Name, b.Name)); }

function addStats(before: string | undefined, add: string): string {
  if (!before) return add;
  let attack = 0, health = 0, any = false;
  const rest: string[] = [];
  for (const label of [before, add])
    for (const raw of label.split(",")) {
      const part = raw.trim();
      const m = /^([+-]\d+)\/([+-]\d+)$/.exec(part);
      if (m) { attack += Number(m[1]); health += Number(m[2]); any = true; }
      else if (part.length > 0 && !rest.includes(part)) rest.push(part);
    }
  if (any && (attack !== 0 || health !== 0)) rest.push(`${attack >= 0 ? "+" : ""}${attack}/${health >= 0 ? "+" : ""}${health}`);
  return rest.join(", ");
}

function modCore(label: string | undefined): string {
  if (!label) return "";
  return label.split(",").map(p => p.trim()).filter(p => p.startsWith("cost ") || p.startsWith("+") || p.startsWith("-")).join(", ");
}

function botLookup(bots: BotDecks | undefined, aiId: number, scenario: string): { cards: Map<string, number>; name: string } | null {
  if (!bots) return null;
  let key = "";
  if (bots.byAiId && String(aiId) in bots.byAiId) key = bots.byAiId[String(aiId)];
  else if (bots.byScenario && scenario.length > 0 && scenario in bots.byScenario) key = bots.byScenario[scenario];
  const deck = key && bots.decks ? bots.decks[key] : undefined;
  if (!deck?.cards) return null;
  const cards = new Map<string, number>();
  for (const c of deck.cards) {
    const id = String(c.id ?? ""), n = Number(c.count ?? 0);
    if (id.length === 0 || n <= 0) continue;
    inc(cards, id, n);
  }
  return cards.size > 0 ? { cards, name: deck.name ?? "" } : null;
}
