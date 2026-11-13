// Entry of the module the port loads (Script.evaluate inside Il2Cpp.perform, after its core has initialized).
// Contract: docs/loader-contract.md. Nothing here may throw into the game.
import { RDT_VERSION } from "../core";
import { port } from "./port";
import { startRecorder, externalDir, mkdirs } from "./recorder";
import { startLive } from "./live";
import { startDeckWindow } from "./deckwindow";
import { startBots } from "./bots";

const p = port();
try {
  p.log(`rdt ${RDT_VERSION} (port ${p.version ?? "?"}, il2cpp ${typeof (globalThis as any).Il2Cpp !== "undefined" ? "ok" : "missing"})`);
  if (typeof (globalThis as any).Il2Cpp !== "undefined") {
    let live: ReturnType<typeof startLive> | undefined;
    try { let bots: ReturnType<typeof startBots> | undefined;
    try { bots = startBots(p); } catch (e) { p.log(`bots: off (${e})`); }
    live = startLive(p, `${externalDir(p)}/rdt`, undefined, mkdirs, bots); p.log("tracking: on"); }
    catch (e) { p.log(`tracking: off (${e})`); }
    if (live) {
      const current = live.current;
      try { const w = startDeckWindow(p, current); live.onDeckLoaded = w.onMatch; live.onUpdate = w.onUpdate; } catch (e) { p.log(`window: off (${e})`); }
    }
    startRecorder(p, live?.onQueue);
  }
} catch (e) {
  try { p.log(`rdt start failed: ${e}`); } catch (_) { /* never break the game */ }
}
