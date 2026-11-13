// The lines of a replay log that both trackers must agree on (window contents and the final self-check).
// Everything else (event wording, timings, overlay internals) may differ between the PC and the TS core.
const KEEP = [/^UI deck/, /^UI opp/, /^CHECK:/, /^Opponent: /, /^=== REPLAY END/];
export function normalize(text) {
  return text.split(/\r?\n/).map(l => l.trimEnd()).filter(l => KEEP.some(r => r.test(l)));
}
