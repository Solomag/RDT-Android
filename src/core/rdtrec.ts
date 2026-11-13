// Match recordings (.rdtrec), the same format as the PC tracker (MatchTracker.Replay.cs):
// chunks of [1 byte type][int32 little-endian length][data].
//   type 0: header, UTF-8 "key=value" lines (local, deck, code, name); written again when it changes
//   type 1: one CcgRpc.HistoryQueue, protobuf bytes
// Platform-free: used by the phone recorder and by the Node tests.

export const ChunkHeader = 0;
export const ChunkQueue = 1;

export interface Chunk { type: number; data: Uint8Array; }

export function encodeChunk(type: number, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(5 + data.length);
  out[0] = type;
  new DataView(out.buffer).setInt32(1, data.length, true);
  out.set(data, 5);
  return out;
}

// A truncated last chunk (the game was closed mid-write) is dropped, like on PC.
export function decodeChunks(all: Uint8Array): Chunk[] {
  const chunks: Chunk[] = [];
  const view = new DataView(all.buffer, all.byteOffset, all.byteLength);
  let pos = 0;
  while (pos + 5 <= all.length) {
    const type = all[pos];
    const length = view.getInt32(pos + 1, true);
    pos += 5;
    if (length < 0 || length > all.length - pos) break;
    chunks.push({ type, data: all.subarray(pos, pos + length) });
    pos += length;
  }
  return chunks;
}

export interface RecordHeader { local?: string; deck?: string; code?: string; name?: string; [key: string]: string | undefined; }

export function encodeHeader(h: RecordHeader): Uint8Array {
  const text = ["local", "deck", "code", "name"].map(k => `${k}=${h[k] ?? ""}`).join("\n") + "\n";
  return utf8Encode(text);
}

// The last non-empty, non-"0" value of each key wins (the deck loads after the first messages).
export function readHeader(chunks: Chunk[]): RecordHeader {
  const header: RecordHeader = {};
  for (const c of chunks) {
    if (c.type !== ChunkHeader) continue;
    for (const line of utf8Decode(c.data).split("\n")) {
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const value = line.slice(eq + 1);
      if (value.length > 0 && value !== "0") header[line.slice(0, eq)] = value;
    }
  }
  return header;
}

// Frida's runtime has no TextEncoder/TextDecoder: a small UTF-8 codec.
export function utf8Encode(s: string): Uint8Array {
  const bytes: number[] = [];
  for (const ch of s) {
    let c = ch.codePointAt(0)!;
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(bytes);
}

export function utf8Decode(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length;) {
    const x = b[i++];
    let c: number;
    if (x < 0x80) c = x;
    else if (x < 0xe0) c = ((x & 31) << 6) | (b[i++] & 63);
    else if (x < 0xf0) c = ((x & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else c = ((x & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    s += String.fromCodePoint(c);
  }
  return s;
}
