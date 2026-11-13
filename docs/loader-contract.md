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
- Inbox override for testing: if the port's inbox contains `rdt.js`, the loader runs it instead of the channel copy, skipping the signature check. This is for development only (see below for where the inbox is and how it is enabled).

## `globalThis.teslPort` (as built in the port, hook/32-rdt-loader.ts)
Types are in `src/frida/port.ts`. Only `log` is required; the module checks the others before using them.
- `version` "2.<core revision>", `core` (number), `log(msg)` (prefix "rdt: "), `dataDir` (<private files>/rdt).
- `settings{get,set}`: keys start with "rdt."; stored in dataDir/settings.json.
- `frameGate(name, fn)`: runs on the main thread on the next frame. Use it for per-frame work instead of attaching to Update yourself.
- `httpGetBytes(url) -> Promise<Uint8Array>` (BestHTTP).
- `hookAttach`: the port's shared attach. `cls(img, "Ns.Class")`, `ucls(name)`, `call(obj, method, ...args)`, `img` (Assembly-CSharp).
- `ui`: uiNew, uiAdd, uiRect, uiPlace, uiStretch, uiText, uiButton, uiLabeledButton.
- `Il2Cpp` is the shared global. The module runs inside Il2Cpp.perform.

## Как порт включает модуль (сейчас)
- Toggle: the file `/sdcard/Android/data/com.bethsoft.theelderscrollslegends/files/tesl-reborn-rdt.json` containing `{"enabled": true}`. An in-game toggle comes later.
- Inbox: `tesl-reborn-inbox/rdt.js` in the same external folder. It works only when `allowLocalUpdates: true` is set in `tesl-reborn-updater.json`. It runs without a signature but still needs the marker.
- A verified new channel revision goes to `<private files>/rdt/rdt.js` + `state.json`. It runs right away if nothing has run yet, otherwise on the next start. While the public key is empty, the loader skips the channel and logs that it did.
- No `dispose` in v1.
