// The API the Android port's core exposes to the RDT module (agreed with the TESL_Reborn_Android session, M1).
// Until it is agreed, only `log` is required; everything else is optional and checked before use.
export interface TeslPort {
  version?: string;
  log(message: string): void;
  settings?: { get(key: string): unknown; set(key: string, value: unknown): void };
  frameGate?: (name: string, fn: () => void) => void;
  httpGetBytes?: (url: string) => Promise<Uint8Array>;
  dataDir?: string;
}

export function port(): TeslPort {
  const p = (globalThis as any).teslPort as TeslPort | undefined;
  if (p && typeof p.log === "function") return p;
  // standalone (frida -l rdt.js during development): console only
  return { log: (m: string) => console.log(`[rdt] ${m}`) };
}
