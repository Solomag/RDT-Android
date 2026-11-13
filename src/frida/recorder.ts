// M2: every server message of a match (CcgRpc.HistoryQueue) goes into <external files>/rdt/replays/<time>.rdtrec,
// in the same format as the PC tracker (MatchTracker.Replay.cs), so the PC can replay phone matches.
// Chunk 0 = header ("local=, deck=, code=, name=" lines; written again when it changes), chunk 1 = one message.
// The phone build has no MessageExtensions.ToByteArray: CalculateSize + CodedOutputStream(byte[]) + WriteTo + Flush.
import { encodeChunk, encodeHeader, ChunkHeader, ChunkQueue, deckCode } from "../core";
import type { TeslPort } from "./port";

const EXTERNAL = "/sdcard/Android/data/com.bethsoft.theelderscrollslegends/files";

export interface MatchDeck { id: string; name: string; cards: Map<string, number> }
export interface QueueEvent {
  translator: string;          // a new LogMessageTranslator instance = a new match stream
  bytes: Uint8Array;           // the HistoryQueue as protobuf (decode with core/proto)
  handle: string;              // the queue object's address (spots a reconnect's past history)
  pastHandle: () => string;    // FullGameState.HistoryQueue in this queue, if any (ask only when the queue has a full state)
  local: number;
  deck: () => MatchDeck | null;
}

export function startRecorder(p: TeslPort, onQueue?: (e: QueueEvent) => void): void {
  const image = p.img ?? Il2Cpp.domain.assembly("Assembly-CSharp").image;
  const klass = (name: string) => (p.cls ? p.cls(image, name) : image.class(name));
  const translator = klass("SPTESL.LogMessageTranslator");
  const add = translator.methods.find((m: any) => m.name === "AddHistoryQueue" && m.parameterCount === 1 && !m.isStatic);
  if (!add || add.virtualAddress.isNull()) { p.log("record: AddHistoryQueue not found; recording off"); return; }
  const byteClass = Il2Cpp.corlib.class("System.Byte");
  const protobuf = Il2Cpp.domain.tryAssembly?.("Google.Protobuf")?.image;
  const outputClass = protobuf ? protobuf.class("Google.Protobuf.CodedOutputStream") : p.ucls!("Google.Protobuf.CodedOutputStream");
  const network = klass("SPTESL.GameNetworkManager");
  const settingsManager = klass("SettingsManager");
  const services = klass("SparkleServices.ServicesManager");

  const dir = `${externalDir(p)}/rdt/replays`;
  mkdirs(dir);
  const deckInfoCache = new Map<string, { name: string; code: string }>();
  let source = "", out: File | null = null, header = "", failed = false, liveFailed = false, lastStamp = "", sameStamp = 0;

  function serialize(queue: any): ArrayBuffer {
    const size = Number(queue.method("CalculateSize").invoke());
    const array = Il2Cpp.array(byteClass, size);
    const stream = outputClass.alloc();
    stream.method(".ctor").overload("System.Byte[]").invoke(array);
    queue.method("WriteTo").invoke(stream);
    stream.method("Flush").invoke();
    return size === 0 ? new ArrayBuffer(0) : array.elements.handle.readByteArray(size);
  }

  function write(type: number, data: Uint8Array) {
    const chunk = encodeChunk(type, data);
    out!.write(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) as ArrayBuffer);
    out!.flush();
  }

  function writeHeader() {
    const deck = matchDeckId();
    // the deck's name and code once per deck id (walking the inventory on every message was the main per-message cost)
    let info = deck !== "0" ? deckInfoCache.get(deck) : { name: "", code: "" };
    if (!info) { info = deckInfo(deck); if (info.code) deckInfoCache.set(deck, info); }
    const h = { local: localPlayerUid(), deck, code: info.code, name: info.name, ...matchSetup() };
    const key = JSON.stringify(h);
    if (key === header) return;
    header = key;
    write(ChunkHeader, encodeHeader(h));
  }

  function manager(): any { return network.method("get_Instance").invoke(); }
  function isSpectating(): boolean { try { const m = manager(); return !isNull(m) && m.field("_isSpectating").value === true; } catch (_) { return false; } }
  function localPlayerUid(): string {
    try { const m = manager(); return isNull(m) ? "0" : String(m.field("_localPlayerUid").value.field("Id").value); } catch (_) { return "0"; }
  }
  function matchDeckId(): string {
    try {
      const s = settingsManager.method("get_Instance").invoke();
      const retry = isNull(s) ? null : s.field("LastRetryMatchRequestData").value;
      return isNull(retry) ? "0" : String(retry.field("DeckId").value);
    } catch (_) { return "0"; }
  }
  // The deck's display name and its code (the PC replay falls back to the code when the id is not in its inventory,
  // e.g. a phone-only or stock deck).
  // RetryData.AiDifficulty (enum Matching.IAiDifficulty: None, Novice, Adept, Expert) and CampaignData.scenarioName,
  // written as "ai" and "scenario" like the PC: the bot deck lookup and the saved deck per bot depend on them.
  function matchSetup(): { ai: string; scenario: string } {
    const out = { ai: "", scenario: "" };
    try {
      const s = settingsManager.method("get_Instance").invoke();
      const retry = isNull(s) ? null : s.field("LastRetryMatchRequestData").value;
      if (isNull(retry)) return out;
      try {
        const v = retry.field("AiDifficulty").value;
        if (v == null) throw Error("no difficulty");
        const n = typeof v === "number" ? v : Number(v?.field?.("value__")?.value ?? v);
        out.ai = ["None", "Novice", "Adept", "Expert"][n] ?? String(n);
      } catch (_) { /* optional */ }
      try {
        const campaign = retry.field("CampaignData").value;
        if (!isNull(campaign)) out.scenario = String(campaign.field("scenarioName").value?.content ?? "");
      } catch (_) { /* optional */ }
    } catch (_) { /* optional */ }
    return out;
  }

  function deckInfo(id: string): { name: string; code: string } {
    const info = { name: "", code: "" };
    try {
      const inventory = services.method("get_Instance").invoke().field("Inventory").value;
      const decks = inventory.method("get_InventoryDescription").invoke().field("decks").value;
      const count = Number(decks.method("get_Count").invoke());
      for (let i = 0; i < count; i++) {
        const deck = decks.method("get_Item").invoke(i);
        if (String(deck.field("id").value) !== id) continue;
        // DisplayName localizes stock deck keys ("…-deck_name") like the PC's loadedDeckName; the raw field is the fallback.
        let name: any = null;
        try { name = deck.method("get_DisplayName").invoke(); } catch (_) { /* older build */ }
        info.name = String(name?.content ?? deck.field("displayName").value?.content ?? "");
        try { info.code = codeOfDeck(inventory, deck); } catch (_) { /* the code is optional */ }
        break;
      }
    } catch (_) { /* header extras only */ }
    return info;
  }

  function codeOfDeck(inventory: any, deck: any): string {
    // The game builds HashToCodeLookup lazily from CardTypeLookup; called before the inventory description is loaded it
    // caches EMPTY tables until restart (breaking its own deck export). Only touch it with the description loaded, and
    // drop empty cached tables so the game rebuilds them.
    if (isNull(inventory.field("_inventoryDescription").value)) return "";
    const types = inventory.method("get_CardTypeLookup").invoke();
    if (isNull(types) || Number(types.method("get_Count").invoke()) === 0) return "";
    const cached = inventory.field("_hashToCodeCached").value;
    if (!isNull(cached) && Number(cached.method("get_Count").invoke()) === 0) {
      inventory.field("_hashToCodeCached").value = null;
      inventory.field("_codeToHashCached").value = null;
    }
    const codes = inventory.method("get_HashToCodeLookup").invoke();
    const counts = deckCounts(inventory, deck);
    return deckCode(counts, h => (codes.method("ContainsKey").invoke(h) ? String(codes.method("get_Item").invoke(h).content) : undefined));
  }

  // The deck's copies per base card (alternate arts folded into their base), from the inventory.
  function deckCounts(inventory: any, deck: any): Map<number, number> {
    const types = inventory.method("get_CardTypeLookup").invoke();
    const cards = deck.field("cards").value;
    const counts = new Map<number, number>();
    const n = Number(cards.method("get_Count").invoke());
    for (let i = 0; i < n; i++) {
      const card = cards.method("get_Item").invoke(i);
      const hash = Number(card.field("typeHash").value);
      const copies = Number(card.field("numRegular").value) + Number(card.field("numPremium").value);
      if (copies <= 0) continue;
      let base = hash;
      if (!isNull(types) && types.method("ContainsKey").invoke(hash)) {
        const alt = Number(types.method("get_Item").invoke(hash).field("AlternateOfCardTypeHash").value);
        if (alt) base = alt;
      }
      counts.set(base, (counts.get(base) ?? 0) + copies);
    }
    return counts;
  }

  // The match deck for the live tracker: id, name and copies, or null while the game has not loaded it.
  function matchDeck(): MatchDeck | null {
    const id = matchDeckId();
    if (id === "0") return null;
    try {
      const inventory = services.method("get_Instance").invoke().field("Inventory").value;
      const decks = inventory.method("get_InventoryDescription").invoke().field("decks").value;
      const count = Number(decks.method("get_Count").invoke());
      for (let i = 0; i < count; i++) {
        const deck = decks.method("get_Item").invoke(i);
        if (String(deck.field("id").value) !== id) continue;
        const cards = new Map<string, number>();
        for (const [hash, n] of deckCounts(inventory, deck)) cards.set(String(hash), n);
        return { id, name: deckInfo(id).name, cards };
      }
    } catch (_) { /* not loaded yet */ }
    return null;
  }

  // FullGameState.HistoryQueue inside a queue (a reconnect's past history, which then comes through AddHistoryQueue)
  function pastHistoryHandle(queue: any): string {
    try {
      const items = queue.method("get_Queue").invoke();
      const n = Number(items.method("get_Count").invoke());
      for (let i = 0; i < n; i++) {
        const state = items.method("get_Item").invoke(i).method("get_FullGameState").invoke();
        if (isNull(state)) continue;
        const past = state.method("get_HistoryQueue").invoke();
        if (!isNull(past)) return past.handle.toString();
      }
    } catch (_) { /* none */ }
    return "";
  }

  function record(self: any, queue: any): Uint8Array | null {
    if (failed || isSpectating()) return null;
    const key = self.handle.toString();
    if (key !== source) {
      close();
      source = key;
      const now = stamp();
      sameStamp = now === lastStamp ? sameStamp + 1 : 0;
      lastStamp = now;
      const path = `${dir}/${now}${sameStamp ? `-${sameStamp}` : ""}.rdtrec`;
      out = new File(path, "wb");
      header = "";
      p.log(`record: ${path.slice(path.lastIndexOf("/") + 1)}`);
    }
    writeHeader();
    const bytes = new Uint8Array(serialize(queue));
    write(ChunkQueue, bytes);
    return bytes;
  }

  function close() { if (out) { try { out.close(); } catch (_) { /* already closed */ } out = null; } }

  const attach = p.hookAttach ?? ((target: any, callbacks: any) => Interceptor.attach(target, callbacks));
  attach(add.virtualAddress, {
    onEnter(args: any) {
      const self = new Il2Cpp.Object(args[0]), queue = new Il2Cpp.Object(args[1]);
      let bytes: Uint8Array | null = null;
      try { bytes = record(self, queue); }
      catch (error) { failed = true; close(); p.log(`record failed, off until restart: ${error}`); }
      if (!onQueue || liveFailed) return;
      try {
        if (isSpectating()) return;
        if (!bytes) bytes = new Uint8Array(serialize(queue));
        onQueue({ translator: self.handle.toString(), bytes, handle: queue.handle.toString(), pastHandle: () => pastHistoryHandle(queue),
          local: Number(localPlayerUid()), deck: matchDeck });
      } catch (error) { liveFailed = true; p.log(`tracking failed, off until restart: ${(error as any)?.stack ?? error}`); }
    },
  });
  p.log(`record: on, ${dir}`);
}

function isNull(o: any): boolean { return o == null || (o.handle && o.handle.isNull()); }

function stamp(): string {
  const d = new Date(), two = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}`;
}

export function externalDir(p: TeslPort): string {
  try {
    const path = p.ucls!("UnityEngine.Application").method("get_persistentDataPath").invoke();
    if (path?.content) return String(path.content);
  } catch (_) { /* fall back */ }
  return EXTERNAL;
}

function mkdirs(path: string): void {
  const mkdir = new NativeFunction(Process.getModuleByName("libc.so").getExportByName("mkdir"), "int", ["pointer", "int"]);
  let at = "";
  for (const part of path.split("/").filter(Boolean)) { at += `/${part}`; mkdir(Memory.allocUtf8String(at), 0o775); }
}
