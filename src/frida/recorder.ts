// M2: every server message of a match (CcgRpc.HistoryQueue) goes into <external files>/rdt/replays/<time>.rdtrec,
// in the same format as the PC tracker (MatchTracker.Replay.cs), so the PC can replay phone matches.
// Chunk 0 = header ("local=, deck=, code=, name=" lines; written again when it changes), chunk 1 = one message.
// The phone build has no MessageExtensions.ToByteArray: CalculateSize + CodedOutputStream(byte[]) + WriteTo + Flush.
import { encodeChunk, encodeHeader, ChunkHeader, ChunkQueue, deckCode } from "../core";
import type { TeslPort } from "./port";

const EXTERNAL = "/sdcard/Android/data/com.bethsoft.theelderscrollslegends/files";

export function startRecorder(p: TeslPort): void {
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
  let source = "", out: File | null = null, header = "", failed = false, lastStamp = "", sameStamp = 0;

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
    const info = deck !== "0" ? deckInfo(deck) : { name: "", code: "" };
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
    const cards = deck.field("cards").value;
    const counts = new Map<number, number>();
    const n = Number(cards.method("get_Count").invoke());
    for (let i = 0; i < n; i++) {
      const card = cards.method("get_Item").invoke(i);
      const hash = Number(card.field("typeHash").value);
      const copies = Number(card.field("numRegular").value) + Number(card.field("numPremium").value);
      if (copies <= 0) continue;
      let base = hash;
      if (types.method("ContainsKey").invoke(hash)) {
        const alt = Number(types.method("get_Item").invoke(hash).field("AlternateOfCardTypeHash").value);
        if (alt) base = alt;
      }
      counts.set(base, (counts.get(base) ?? 0) + copies);
    }
    return deckCode(counts, h => (codes.method("ContainsKey").invoke(h) ? String(codes.method("get_Item").invoke(h).content) : undefined));
  }

  function record(self: any, queue: any) {
    if (failed || isSpectating()) return;
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
    write(ChunkQueue, new Uint8Array(serialize(queue)));
  }

  function close() { if (out) { try { out.close(); } catch (_) { /* already closed */ } out = null; } }

  const attach = p.hookAttach ?? ((target: any, callbacks: any) => Interceptor.attach(target, callbacks));
  attach(add.virtualAddress, {
    onEnter(args: any) {
      try { record(new Il2Cpp.Object(args[0]), new Il2Cpp.Object(args[1])); }
      catch (error) { failed = true; close(); p.log(`record failed, off until restart: ${error}`); }
    },
  });
  p.log(`record: on, ${dir}`);
}

function isNull(o: any): boolean { return o == null || (o.handle && o.handle.isNull()); }

function stamp(): string {
  const d = new Date(), two = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}`;
}

function externalDir(p: TeslPort): string {
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
