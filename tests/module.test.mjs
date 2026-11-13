// The built module (build/rdt.js) run the way the port runs it, with a fake Il2Cpp/Frida:
// it must start, hook AddHistoryQueue, and write a .rdtrec the PC format reads back.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { decodeChunks, readHeader, utf8Decode } from "../build/core.mjs";

const code = readFileSync(new URL("../build/rdt.js", import.meta.url), "utf8");
const handle = n => ({ isNull: () => n === 0, toString: () => `0x${n.toString(16)}` });

function fakeWorld() {
  const files = {}, logs = [], hooks = [];
  const obj = (fields = {}, methods = {}, id = 1) => ({
    handle: handle(id),
    field: f => ({ value: fields[f] }),
    method: m => ({ invoke: (...a) => methods[m](...a), overload: () => ({ invoke: (...a) => methods[m](...a) }) }),
  });
  const list = items => obj({}, { get_Count: () => items.length, get_Item: i => items[i] });
  const dict = map => obj({}, { ContainsKey: k => k in map, get_Item: k => map[k], get_Count: () => Object.keys(map).length });
  // card 11 is an alternate art of 10: two copies of 11 + one of 10 count as three of 10
  const cards = list([obj({ typeHash: 10, numRegular: 1, numPremium: 0 }), obj({ typeHash: 11, numRegular: 1, numPremium: 1 }), obj({ typeHash: 20, numRegular: 2, numPremium: 0 })]);
  const deck = obj({ id: { toString: () => "77" }, displayName: { content: "abc-deck_name" }, cards }, { get_DisplayName: () => ({ content: "Колода" }) });
  const types = dict({ 10: obj({ AlternateOfCardTypeHash: 0 }), 11: obj({ AlternateOfCardTypeHash: 10 }), 20: obj({ AlternateOfCardTypeHash: 0 }) });
  const codes = dict({ 10: { content: "xa" }, 20: { content: "yb" } });
  const decks = obj({}, { get_Count: () => 1, get_Item: () => deck });
  const klasses = {
    "SPTESL.LogMessageTranslator": { methods: [{ name: "AddHistoryQueue", parameterCount: 1, isStatic: false, virtualAddress: handle(0x1000) }] },
    "SPTESL.GameNetworkManager": obj({}, { get_Instance: () => obj({ _isSpectating: false, _localPlayerUid: obj({ Id: 5 }) }) }),
    "SettingsManager": obj({}, { get_Instance: () => obj({ LastRetryMatchRequestData: obj({ DeckId: { toString: () => "77" } }) }) }),
    "SparkleServices.ServicesManager": obj({}, { get_Instance: () => obj({ Inventory: obj({ _inventoryDescription: obj({}), _hashToCodeCached: codes }, { get_InventoryDescription: () => obj({ decks }), get_CardTypeLookup: () => types, get_HashToCodeLookup: () => codes }) }) }),
  };
  let array;
  const outputClass = { alloc: () => obj({}, { ".ctor": a => { array = a; }, Flush: () => {} }) };
  const queue = bytes => obj({}, { CalculateSize: () => bytes.length, WriteTo: () => array.data.set(bytes) });
  const Il2Cpp = {
    domain: { assembly: () => ({ image: { class: n => klasses[n] } }), tryAssembly: () => ({ image: { class: () => outputClass } }) },
    corlib: { class: () => ({}) },
    array: (_, n) => { const data = new Uint8Array(n); return array = { data, elements: { handle: { readByteArray: k => data.slice(0, k).buffer } } }; },
    Object: function (h) { return h; },
  };
  class File {
    constructor(path) { this.path = path; files[path] = []; }
    write(b) { files[this.path].push(Buffer.from(b)); } flush() {} close() {}
  }
  const ctx = {
    Il2Cpp, File, Memory: { allocUtf8String: s => s }, Process: { getModuleByName: () => ({ getExportByName: () => 0 }) },
    NativeFunction: function () { return () => 0; }, console,
    teslPort: { version: "2.9", log: m => logs.push(m), hookAttach: (t, cb) => hooks.push(cb), ucls: () => obj({}, { get_persistentDataPath: () => ({ content: "/ext" }) }) },
  };
  ctx.globalThis = ctx;
  return { ctx, files, logs, hooks, queue, translator: id => obj({}, {}, id) };
}

test("module starts and records queues into the PC format", () => {
  const w = fakeWorld();
  vm.runInNewContext(code, w.ctx);
  assert.match(w.logs[0], /^rdt \d+\.\d+\.\d+ \(port 2\.9, il2cpp ok\)/);
  assert.equal(w.hooks.length, 1, w.logs.join("\n"));
  const t = w.translator(42);
  w.hooks[0].onEnter([t, w.queue(Uint8Array.from([8, 1]))]);
  w.hooks[0].onEnter([t, w.queue(Uint8Array.from([8, 2, 9]))]);
  w.hooks[0].onEnter([w.translator(43), w.queue(Uint8Array.from([1]))]); // new match -> new file
  const paths = Object.keys(w.files);
  assert.equal(paths.length, 2, w.logs.join("\n"));
  assert.ok(paths[0].startsWith("/ext/rdt/replays/") && paths[0].endsWith(".rdtrec"));
  const chunks = decodeChunks(new Uint8Array(Buffer.concat(w.files[paths[0]])));
  assert.deepEqual(chunks.map(c => c.type), [0, 1, 1]);
  assert.deepEqual([...chunks[2].data], [8, 2, 9]);
  const h = readHeader(chunks);
  assert.equal(h.local, "5"); assert.equal(h.deck, "77"); assert.equal(h.name, "Колода");
  assert.match(utf8Decode(chunks[0].data), /^local=5\ndeck=77\ncode=SPAAABybABxa\nname=Колода\n$/);
});

test("module without Il2Cpp only logs", () => {
  const logs = [];
  const ctx = { teslPort: { log: m => logs.push(m) }, console };
  ctx.globalThis = ctx;
  vm.runInNewContext(code, ctx);
  assert.match(logs[0], /il2cpp missing/);
  assert.equal(logs.length, 1);
});
