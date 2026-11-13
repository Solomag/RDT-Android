// The inverse of decode.ts, writing the way Google.Protobuf C# does (fields in number order, proto3 defaults omitted,
// repeated scalars packed). Used by the tests: decode -> encode must give the recorded bytes back exactly,
// and to build synthetic messages for core tests.
import schemaJson from "./schema.json";
import { utf8Encode } from "../rdtrec";

type Field = { name: string; type: string; repeated?: boolean; message?: string };
const schema = schemaJson as unknown as Record<string, Record<string, Field>>;

export function encodeMessage(value: any, message: string): Uint8Array {
  const out: number[] = [];
  write(out, value, message);
  return Uint8Array.from(out);
}

function write(out: number[], value: any, message: string) {
  const fields = schema[message];
  for (const number of Object.keys(fields).map(Number).sort((a, b) => a - b)) {
    const f = fields[number], v = value?.[f.name];
    if (f.repeated) {
      if (!v || v.length === 0) continue;
      if (f.type === "message" || f.type === "string" || f.type === "bytes") { for (const item of v) field(out, number, f, item); continue; }
      const packed: number[] = [];
      for (const item of v) scalar(packed, f.type, item);
      varint(out, BigInt(number * 8 + 2)); varint(out, BigInt(packed.length)); out.push(...packed);
      continue;
    }
    if (isDefault(f, v)) continue;
    field(out, number, f, v);
  }
}

function isDefault(f: Field, v: any): boolean {
  if (v == null) return true;
  if (f.type === "message") return false;
  if (f.type === "string" || f.type === "bytes") return v.length === 0;
  return v === 0 || v === false;
}

function field(out: number[], number: number, f: Field, v: any) {
  if (f.type === "message" || f.type === "string" || f.type === "bytes") {
    const body = f.type === "message" ? encodeMessage(v, f.message!) : f.type === "string" ? utf8Encode(v) : v;
    varint(out, BigInt(number * 8 + 2)); varint(out, BigInt(body.length)); for (const b of body) out.push(b);
    return;
  }
  varint(out, BigInt(number * 8 + (f.type === "float" ? 5 : f.type === "double" ? 1 : 0)));
  scalar(out, f.type, v);
}

function scalar(out: number[], type: string, v: any) {
  if (type === "float" || type === "double") {
    const b = new DataView(new ArrayBuffer(type === "float" ? 4 : 8));
    if (type === "float") b.setFloat32(0, v, true); else b.setFloat64(0, v, true);
    for (let i = 0; i < b.byteLength; i++) out.push(b.getUint8(i));
    return;
  }
  if (type === "bool") { out.push(v ? 1 : 0); return; }
  // int32/enum negatives are sign-extended to 64 bits (10 bytes), as protobuf does
  varint(out, BigInt.asUintN(64, BigInt(v)));
}

function varint(out: number[], v: bigint) {
  while (v >= 0x80n) { out.push(Number(v & 0x7fn) | 0x80); v >>= 7n; }
  out.push(Number(v));
}
