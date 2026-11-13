// RDT-ANDROID-MODULE v1

(() => {
  // src/core/deckcode.ts
  function deckCode(countsByBase, codeOf) {
    const byCount = Array.from({ length: 9 }, () => []);
    let max = 3;
    for (const [hash, count] of countsByBase) {
      const code = codeOf(hash);
      if (!code || count <= 0 || count >= 9) return "";
      max = Math.max(max, count);
      byCount[count].push(code);
    }
    let out = "SP";
    for (let count = 1; count <= max; count++) {
      const n = byCount[count].length;
      out += String.fromCharCode(65 + Math.floor(n / 26), 65 + n % 26) + byCount[count].join("");
    }
    return out;
  }

  // src/core/rdtrec.ts
  var ChunkHeader = 0;
  var ChunkQueue = 1;
  function encodeChunk(type, data) {
    const out = new Uint8Array(5 + data.length);
    out[0] = type;
    new DataView(out.buffer).setInt32(1, data.length, true);
    out.set(data, 5);
    return out;
  }
  function encodeHeader(h) {
    const text = ["local", "deck", "code", "name"].map((k) => `${k}=${h[k] ?? ""}`).join("\n") + "\n";
    return utf8Encode(text);
  }
  function utf8Encode(s) {
    const bytes = [];
    for (const ch of s) {
      let c = ch.codePointAt(0);
      if (c < 128) bytes.push(c);
      else if (c < 2048) bytes.push(192 | c >> 6, 128 | c & 63);
      else if (c < 65536) bytes.push(224 | c >> 12, 128 | c >> 6 & 63, 128 | c & 63);
      else bytes.push(240 | c >> 18, 128 | c >> 12 & 63, 128 | c >> 6 & 63, 128 | c & 63);
    }
    return Uint8Array.from(bytes);
  }

  // src/core/index.ts
  var RDT_VERSION = "0.2.3";

  // src/frida/port.ts
  function port() {
    const p2 = globalThis.teslPort;
    if (p2 && typeof p2.log === "function") return p2;
    return { log: (m) => console.log(`[rdt] ${m}`) };
  }

  // src/frida/recorder.ts
  var EXTERNAL = "/sdcard/Android/data/com.bethsoft.theelderscrollslegends/files";
  function startRecorder(p2) {
    const image = p2.img ?? Il2Cpp.domain.assembly("Assembly-CSharp").image;
    const klass = (name) => p2.cls ? p2.cls(image, name) : image.class(name);
    const translator = klass("SPTESL.LogMessageTranslator");
    const add = translator.methods.find((m) => m.name === "AddHistoryQueue" && m.parameterCount === 1 && !m.isStatic);
    if (!add || add.virtualAddress.isNull()) {
      p2.log("record: AddHistoryQueue not found; recording off");
      return;
    }
    const byteClass = Il2Cpp.corlib.class("System.Byte");
    const protobuf = Il2Cpp.domain.tryAssembly?.("Google.Protobuf")?.image;
    const outputClass = protobuf ? protobuf.class("Google.Protobuf.CodedOutputStream") : p2.ucls("Google.Protobuf.CodedOutputStream");
    const network = klass("SPTESL.GameNetworkManager");
    const settingsManager = klass("SettingsManager");
    const services = klass("SparkleServices.ServicesManager");
    const dir = `${externalDir(p2)}/rdt/replays`;
    mkdirs(dir);
    let source = "", out = null, header = "", failed = false, lastStamp = "", sameStamp = 0;
    function serialize(queue) {
      const size = Number(queue.method("CalculateSize").invoke());
      const array = Il2Cpp.array(byteClass, size);
      const stream = outputClass.alloc();
      stream.method(".ctor").overload("System.Byte[]").invoke(array);
      queue.method("WriteTo").invoke(stream);
      stream.method("Flush").invoke();
      return size === 0 ? new ArrayBuffer(0) : array.elements.handle.readByteArray(size);
    }
    function write(type, data) {
      const chunk = encodeChunk(type, data);
      out.write(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength));
      out.flush();
    }
    function writeHeader() {
      const deck = matchDeckId();
      const info = deck !== "0" ? deckInfo(deck) : { name: "", code: "" };
      const h = { local: localPlayerUid(), deck, code: info.code, name: info.name };
      const key = JSON.stringify(h);
      if (key === header) return;
      header = key;
      write(ChunkHeader, encodeHeader(h));
    }
    function manager() {
      return network.method("get_Instance").invoke();
    }
    function isSpectating() {
      try {
        const m = manager();
        return !isNull(m) && m.field("_isSpectating").value === true;
      } catch (_) {
        return false;
      }
    }
    function localPlayerUid() {
      try {
        const m = manager();
        return isNull(m) ? "0" : String(m.field("_localPlayerUid").value.field("Id").value);
      } catch (_) {
        return "0";
      }
    }
    function matchDeckId() {
      try {
        const s = settingsManager.method("get_Instance").invoke();
        const retry = isNull(s) ? null : s.field("LastRetryMatchRequestData").value;
        return isNull(retry) ? "0" : String(retry.field("DeckId").value);
      } catch (_) {
        return "0";
      }
    }
    function deckInfo(id) {
      const info = { name: "", code: "" };
      try {
        const inventory = services.method("get_Instance").invoke().field("Inventory").value;
        const decks = inventory.method("get_InventoryDescription").invoke().field("decks").value;
        const count = Number(decks.method("get_Count").invoke());
        for (let i = 0; i < count; i++) {
          const deck = decks.method("get_Item").invoke(i);
          if (String(deck.field("id").value) !== id) continue;
          let name = null;
          try {
            name = deck.method("get_DisplayName").invoke();
          } catch (_) {
          }
          info.name = String(name?.content ?? deck.field("displayName").value?.content ?? "");
          try {
            info.code = codeOfDeck(inventory, deck);
          } catch (_) {
          }
          break;
        }
      } catch (_) {
      }
      return info;
    }
    function codeOfDeck(inventory, deck) {
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
      const counts = /* @__PURE__ */ new Map();
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
      return deckCode(counts, (h) => codes.method("ContainsKey").invoke(h) ? String(codes.method("get_Item").invoke(h).content) : void 0);
    }
    function record(self, queue) {
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
        p2.log(`record: ${path.slice(path.lastIndexOf("/") + 1)}`);
      }
      writeHeader();
      write(ChunkQueue, new Uint8Array(serialize(queue)));
    }
    function close() {
      if (out) {
        try {
          out.close();
        } catch (_) {
        }
        out = null;
      }
    }
    const attach = p2.hookAttach ?? ((target, callbacks) => Interceptor.attach(target, callbacks));
    attach(add.virtualAddress, {
      onEnter(args) {
        try {
          record(new Il2Cpp.Object(args[0]), new Il2Cpp.Object(args[1]));
        } catch (error) {
          failed = true;
          close();
          p2.log(`record failed, off until restart: ${error}`);
        }
      }
    });
    p2.log(`record: on, ${dir}`);
  }
  function isNull(o) {
    return o == null || o.handle && o.handle.isNull();
  }
  function stamp() {
    const d = /* @__PURE__ */ new Date(), two = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}`;
  }
  function externalDir(p2) {
    try {
      const path = p2.ucls("UnityEngine.Application").method("get_persistentDataPath").invoke();
      if (path?.content) return String(path.content);
    } catch (_) {
    }
    return EXTERNAL;
  }
  function mkdirs(path) {
    const mkdir = new NativeFunction(Process.getModuleByName("libc.so").getExportByName("mkdir"), "int", ["pointer", "int"]);
    let at = "";
    for (const part of path.split("/").filter(Boolean)) {
      at += `/${part}`;
      mkdir(Memory.allocUtf8String(at), 509);
    }
  }

  // src/frida/main.ts
  var p = port();
  try {
    p.log(`rdt ${RDT_VERSION} (port ${p.version ?? "?"}, il2cpp ${typeof globalThis.Il2Cpp !== "undefined" ? "ok" : "missing"})`);
    if (typeof globalThis.Il2Cpp !== "undefined") startRecorder(p);
  } catch (e) {
    try {
      p.log(`rdt start failed: ${e}`);
    } catch (_) {
    }
  }
})();
