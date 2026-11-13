// M2: every server message of a match (CcgRpc.HistoryQueue) goes into <external files>/rdt/replays/<time>.rdtrec,
// in the same format as the PC tracker (MatchTracker.Replay.cs), so the PC can replay phone matches.
// Chunk 0 = header ("local=, deck=, code=, name=" lines; written again when it changes), chunk 1 = one message.
// The phone build has no MessageExtensions.ToByteArray: CalculateSize + CodedOutputStream(byte[]) + WriteTo + Flush.
import { encodeChunk, encodeHeader, ChunkHeader, ChunkQueue } from "../core";
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
    const h = { local: localPlayerUid(), deck, code: "", name: deck !== "0" ? deckName(deck) : "" };
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
  function deckName(id: string): string {
    try {
      const inventory = services.method("get_Instance").invoke().field("Inventory").value;
      const decks = inventory.method("get_InventoryDescription").invoke().field("decks").value;
      const count = Number(decks.method("get_Count").invoke());
      for (let i = 0; i < count; i++) {
        const deck = decks.method("get_Item").invoke(i);
        if (String(deck.field("id").value) === id) return String(deck.field("displayName").value?.content ?? "");
      }
    } catch (_) { /* name is only for people reading the file */ }
    return "";
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
