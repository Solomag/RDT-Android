// Entry of the module the port loads (Script.evaluate after its core has initialized).
// M1: proves that download, signature check and start work; the tracker itself comes in M2+.
import { RDT_VERSION } from "../core";
import { port } from "./port";

const p = port();
try {
  p.log(`rdt hello ${RDT_VERSION} (port ${p.version ?? "?"}, il2cpp ${typeof (globalThis as any).Il2Cpp !== "undefined" ? "ok" : "missing"})`);
} catch (e) {
  try { p.log(`rdt start failed: ${e}`); } catch (_) { /* never break the game */ }
}
