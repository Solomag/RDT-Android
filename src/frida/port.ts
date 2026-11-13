// The API the Android port's RDT loader puts in globalThis.teslPort (C:\tr\r hook/32-rdt-loader.ts, M1).
// The module checks optional members before use, so it still runs standalone (frida -l rdt.js) with console only.
export interface TeslPort {
  version?: string;                 // "2.<core revision>"
  core?: number;                    // core revision
  log(message: string): void;       // into the port's log, prefixed "rdt: "
  dataDir?: string;                 // <private files>/rdt
  settings?: { get(key: string): unknown; set(key: string, value: unknown): void }; // keys must start with "rdt."; saved to dataDir/settings.json
  frameGate?: (name: string, fn: () => void) => void;      // main thread, next frame; errors logged by the port
  httpGetBytes?: (url: string) => Promise<Uint8Array>;     // the game's BestHTTP
  hookAttach?: (...args: any[]) => unknown;                // the port's shared attach (onLeave-only attaches on one method are merged)
  cls?: (img: any, fullName: string) => any;               // class by "Ns.Class" in an image
  ucls?: (name: string) => any;                            // UnityEngine class
  call?: (obj: any, method: string, ...args: any[]) => any;
  img?: any;                                               // Assembly-CSharp image
  ui?: Record<"uiNew" | "uiAdd" | "uiRect" | "uiPlace" | "uiStretch" | "uiText" | "uiButton" | "uiLabeledButton", (...args: any[]) => any>;
}

export function port(): TeslPort {
  const p = (globalThis as any).teslPort as TeslPort | undefined;
  if (p && typeof p.log === "function") return p;
  // standalone (frida -l rdt.js during development): console only
  return { log: (m: string) => console.log(`[rdt] ${m}`) };
}
