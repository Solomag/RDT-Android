// node tools/gen-schema.mjs <path to Il2CppDumper dump.cs>  -> src/core/proto/schema.json
// The protobuf schema of CcgRpc.HistoryQueue and every message it reaches: field numbers, types, repeated.
// Only names and numbers (what a .proto holds) are kept; no game code. The dump itself stays outside the repo.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
process.chdir(fileURLToPath(new URL("..", import.meta.url)));

const dump = readFileSync(process.argv[2] ?? "E:/tr/dump/dump.cs", "utf8").split(/\r?\n/);
const SCALARS = { int: "int32", uint: "uint32", long: "int64", ulong: "uint64", bool: "bool", string: "string", float: "float", double: "double", ByteString: "bytes" };
const messages = {}, enums = new Set();
let ns = "";
for (let i = 0; i < dump.length; i++) {
  const line = dump[i];
  const nsm = /^\/\/ Namespace: ?(.*)$/.exec(line);
  if (nsm) { ns = nsm[1].trim(); continue; }
  const em = /^public enum (\S+)/.exec(line);
  if (em) { enums.add(ns ? `${ns}.${em[1]}` : em[1]); enums.add(em[1]); continue; }
  const cm = /^public sealed class (\S+) : IMessage<\1>/.exec(line);
  if (!cm) continue;
  const name = ns ? `${ns}.${cm[1]}` : cm[1];
  const numbers = {}, props = {};
  for (let j = i + 1; j < dump.length && !/^}/.test(dump[j]); j++) {
    const f = /public const int (\w+)FieldNumber = (\d+);/.exec(dump[j]);
    if (f) numbers[f[1]] = Number(f[2]);
    const p = /^\tpublic (?!static)([\w.<>]+) (\w+) \{ get;/.exec(dump[j]);
    if (p) props[p[2]] = p[1];
  }
  messages[name] = { ns, numbers, props };
}

function resolve(type, ns) {
  const repeated = /^(?:RepeatedField|MapField)<(.+)>$/.exec(type);
  const inner = repeated ? repeated[1] : type;
  if (SCALARS[inner]) return { type: SCALARS[inner], repeated: !!repeated };
  for (const full of [`${ns}.${inner}`, inner]) {
    if (messages[full]) return { type: "message", message: full, repeated: !!repeated };
    if (enums.has(full)) return { type: "enum", repeated: !!repeated };
  }
  return { type: "unknown:" + inner, repeated: !!repeated };
}

const out = {}, queue = ["CcgRpc.HistoryQueue"];
while (queue.length) {
  const name = queue.shift();
  if (out[name]) continue;
  const m = messages[name];
  if (!m) throw Error(`message ${name} not in the dump`);
  const fields = {};
  for (const [prop, number] of Object.entries(m.numbers)) {
    const t = m.props[prop];
    if (!t) throw Error(`${name}.${prop}: no property`);
    const r = resolve(t, m.ns);
    if (r.type.startsWith("unknown")) throw Error(`${name}.${prop}: ${r.type}`);
    fields[number] = { name: prop, type: r.type, ...(r.repeated ? { repeated: true } : {}), ...(r.message ? { message: r.message } : {}) };
    if (r.message && !out[r.message]) queue.push(r.message);
  }
  out[name] = fields;
}
const sorted = Object.fromEntries(Object.keys(out).sort().map(k => [k, out[k]]));
writeFileSync("src/core/proto/schema.json", JSON.stringify(sorted, null, 1) + "\n");
console.log(`schema: ${Object.keys(sorted).length} messages, ${Object.values(sorted).reduce((n, f) => n + Object.keys(f).length, 0)} fields`);
