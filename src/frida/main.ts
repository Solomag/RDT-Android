// Entry of the module the port loads (Script.evaluate inside Il2Cpp.perform, after its core has initialized).
// Contract: docs/loader-contract.md. Nothing here may throw into the game.
import { RDT_VERSION } from "../core";
import { port } from "./port";
import { startRecorder } from "./recorder";

const p = port();
try {
  p.log(`rdt ${RDT_VERSION} (port ${p.version ?? "?"}, il2cpp ${typeof (globalThis as any).Il2Cpp !== "undefined" ? "ok" : "missing"})`);
  if (typeof (globalThis as any).Il2Cpp !== "undefined") startRecorder(p);
} catch (e) {
  try { p.log(`rdt start failed: ${e}`); } catch (_) { /* never break the game */ }
}
