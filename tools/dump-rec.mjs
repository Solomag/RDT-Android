// node tools/dump-rec.mjs <file.rdtrec> [--json]  -> header, message count, item types; --json prints every decoded queue
import { readFileSync } from "node:fs";
import { decodeChunks, readHeader, decodeHistoryQueue, ChunkQueue } from "../build/core.mjs";
const chunks = decodeChunks(new Uint8Array(readFileSync(process.argv[2])));
const stats = { unknownFields: 0 }, types = {};
const queues = chunks.filter(c => c.type === ChunkQueue).map(c => decodeHistoryQueue(c.data, stats));
for (const q of queues) for (const item of q.Queue) types[item.Type] = (types[item.Type] ?? 0) + 1;
if (process.argv.includes("--json")) console.log(JSON.stringify(queues, null, 1));
else console.log(JSON.stringify({ header: readHeader(chunks), messages: queues.length, items: queues.reduce((n, q) => n + q.Queue.length, 0), unknownFields: stats.unknownFields, types }));
