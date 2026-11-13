// Minimal protobuf (proto3) decoder driven by schema.json (generated from the dump by tools/gen-schema.mjs).
// Output: plain objects with the C# property names and proto3 defaults (0, false, "", [], null for a message),
// the same shape the phone adapter reads from the live Il2Cpp objects. Unknown fields are skipped and counted.
import schemaJson from "./schema.json";
import { utf8Decode } from "../rdtrec";

type Field = { name: string; type: string; repeated?: boolean; message?: string };
const schema = schemaJson as unknown as Record<string, Record<string, Field>>;

export interface DecodeStats { unknownFields: number }

export function decodeMessage(bytes: Uint8Array, message: string, stats: DecodeStats = { unknownFields: 0 }): any {
  return new Reader(bytes, stats).message(message, bytes.length);
}

export function decodeHistoryQueue(bytes: Uint8Array, stats?: DecodeStats): any {
  return decodeMessage(bytes, "CcgRpc.HistoryQueue", stats);
}

function defaults(message: string): any {
  const fields = schema[message];
  if (!fields) throw Error(`unknown message ${message}`);
  const o: any = {};
  for (const f of Object.values(fields)) {
    o[f.name] = f.repeated ? [] : f.type === "message" ? null : f.type === "bool" ? false : f.type === "string" ? "" : f.type === "bytes" ? new Uint8Array(0) : 0;
  }
  return o;
}

class Reader {
  pos = 0;
  constructor(private buf: Uint8Array, private stats: DecodeStats) {}

  message(name: string, end: number): any {
    const fields = schema[name], o = defaults(name);
    while (this.pos < end) {
      const tag = this.varint();
      const number = Math.floor(tag / 8), wire = tag & 7;
      const f = fields[number];
      if (!f) { this.stats.unknownFields++; this.skip(wire); continue; }
      if (f.repeated && wire === 2 && f.type !== "message" && f.type !== "string" && f.type !== "bytes") {
        const stop = this.length();
        while (this.pos < stop) o[f.name].push(this.scalar(f.type, f.type === "float" ? 5 : f.type === "double" ? 1 : 0));
        continue;
      }
      const v = this.value(f, wire);
      if (f.repeated) o[f.name].push(v); else o[f.name] = v;
    }
    if (this.pos !== end) throw Error(`${name}: read past its end`);
    return o;
  }

  value(f: Field, wire: number): any {
    if (f.type === "message") { this.expect(wire, 2, f); const stop = this.length(); return this.message(f.message!, stop); }
    if (f.type === "string") { this.expect(wire, 2, f); const stop = this.length(); const s = utf8Decode(this.buf.subarray(this.pos, stop)); this.pos = stop; return s; }
    if (f.type === "bytes") { this.expect(wire, 2, f); const stop = this.length(); const b = this.buf.slice(this.pos, stop); this.pos = stop; return b; }
    return this.scalar(f.type, wire);
  }

  scalar(type: string, wire: number): number | boolean {
    if (wire === 5) { const v = new DataView(this.buf.buffer, this.buf.byteOffset + this.pos, 4); this.pos += 4; return type === "float" ? v.getFloat32(0, true) : type === "int32" ? v.getInt32(0, true) : v.getUint32(0, true); }
    if (wire === 1) { const v = new DataView(this.buf.buffer, this.buf.byteOffset + this.pos, 8); this.pos += 8; return type === "double" ? v.getFloat64(0, true) : Number(v.getBigInt64(0, true)); }
    if (wire !== 0) throw Error(`${type}: unexpected wire type ${wire}`);
    const v = this.varintBig();
    if (type === "bool") return v !== 0n;
    if (type === "int32" || type === "enum") return Number(BigInt.asIntN(32, v));
    if (type === "uint32") return Number(BigInt.asUintN(32, v));
    if (type === "int64") return Number(BigInt.asIntN(64, v));
    return Number(v);
  }

  expect(wire: number, want: number, f: Field) { if (wire !== want) throw Error(`${f.name}: wire type ${wire}, expected ${want}`); }

  length(): number {
    const n = this.varint(), stop = this.pos + n;
    if (stop > this.buf.length) throw Error("length past the end");
    return stop;
  }

  varint(): number { return Number(this.varintBig()); }

  varintBig(): bigint {
    let result = 0n, shift = 0n;
    for (;;) {
      if (this.pos >= this.buf.length) throw Error("varint past the end");
      const b = this.buf[this.pos++];
      result |= BigInt(b & 0x7f) << shift;
      if (b < 0x80) return result;
      shift += 7n;
      if (shift > 63n) throw Error("varint too long");
    }
  }

  skip(wire: number) {
    if (wire === 0) this.varintBig();
    else if (wire === 1) this.pos += 8;
    else if (wire === 5) this.pos += 4;
    else if (wire === 2) this.pos = this.length();
    else throw Error(`cannot skip wire type ${wire}`);
  }
}
