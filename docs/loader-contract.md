# Контракт загрузчика RDT в порте (M1)

The agreement between the RDT module (this repo) and the loader in the TESL Reborn Android port (C:\tr\r).

## Канал
- Manifest: `https://raw.githubusercontent.com/Solomag/RDT-Android/main/release/manifest.json`
  `{ revision, minCore, bytes, sha256, sig, url }`.
- `sig` = ed25519 (hex, 64 bytes) over the UTF-8 string `"<sha256>:<revision>"`. The public key (32 bytes hex) is pinned in the loader and printed by `node tools/keygen.mjs`.
- Order of checks in the loader:
  1. `sig` against the pinned key;
  2. `revision` is greater than or equal to the cached one, never lower;
  3. `minCore` ≤ the port's version;
  4. download `url`;
  5. `bytes` and `sha256` of the payload;
  6. the payload starts with `// RDT-ANDROID-MODULE v1`.

  If anything fails, keep the cached copy. If there is no cached copy, do not load the module.
- Verification: `vendor/tweetnacl-verify.js` (TweetNaCl-js 1.0.3, verify-only, public domain) exposes `tweetnaclVerify(msg, sig, pk)`. All three arguments are `Uint8Array`; it returns a boolean. Tested against node:crypto in `tests/tweetnacl-verify.test.mjs`.

## Запуск
- **The toggle is off by default.** When it is off, the loader does not even download the module.
- Load the module once per process: after the core has initialized and Il2Cpp is ready, from the same place where hooks are safe.
- Before running the module, the loader sets `globalThis.teslPort`. It then runs the module with `Script.evaluate("/rdt/rdt.js", code)` inside try/catch. Any error from the module is logged and must not break the game.
- **The payload exports nothing.** It is a single ES2020 IIFE that starts itself at top level: it reads `globalThis.teslPort` and sets up its own hooks through the shared `Il2Cpp` global (frida-il2cpp-bridge from the core).
- Version 1 has no hot unload: turning the toggle off takes effect on the next game start. Later the module may set `globalThis.rdt = { version, dispose() }`. If the loader finds it, it can call `dispose()` when the toggle is switched off. This is optional.
- Inbox override for testing: if the port's inbox contains `rdt.js`, the loader runs it instead of the channel copy, skipping the signature check. This is for development only, and the inbox lives in private storage.

## `globalThis.teslPort`
Only `log` is required. Everything else is optional, and the module checks for it before use (`src/frida/port.ts`):

```ts
interface TeslPort {
  version?: string;                                    // port/core version
  log(message: string): void;                          // into the port's log
  settings?: { get(key: string): unknown; set(key: string, value: unknown): void }; // RDT's own keys, prefix "rdt."
  frameGate?: (name: string, fn: () => void) => void;  // run on the Unity main thread / next frame
  httpGetBytes?: (url: string) => Promise<Uint8Array>; // later: decks/card data
  dataDir?: string;                                    // private dir for RDT files (recordings, pools)
}
```

The loader session publishes the final API shape after M1. This file is then updated to match.
