# RDT Android

**Reborn Deck Tracker for the Android port of The Elder Scrolls: Legends (TESL Reborn).**

During a match it shows which cards are still left in your deck and what your opponent has played, right in the game's own card list. It is the Android counterpart of the PC deck tracker and uses the same counting core, rewritten in TypeScript.

## Features
- **Your deck:** the cards still left in your deck, shown as "left / total" per card, the same as on PC.
- **Opponent:** the cards your opponent has revealed. Against bots it shows the bot's whole deck, taken from [tesl-decks.com](https://tesl-decks.com).
- **Modified copies:** cards changed inside your deck are listed as separate rows, with their new cost, stats and keywords.
- **Live updates:** an open list refreshes itself as the match goes on.
- **Match recordings:** every match is saved as an `.rdtrec` file in the PC tracker's format, so it can be replayed and checked on PC.

## How to get it
RDT is an optional module of the [TESL Reborn Android port](https://github.com/ssorgatem/tesl-reborn-android). You don't install anything separately:

1. Install or update the game through the port's Builder (no root needed).
2. Open the port's settings and turn on **Deck tracker**.
3. The port downloads the module from this repository and starts it the next time you launch the game.

The module is signed. The port checks the signature, file size, hash and version before it runs a download, and refuses anything that doesn't match.

## Status
Active development. Current release: 9 (module 0.7.2). Tap the game's own deck icon (the card icon in the right-hand column, yours or the opponent's) to open that side's list, and tap it again to close it, like on PC. The working log is [docs/plan.md](docs/plan.md) (in Russian).

## Roadmap
**Done**
- Signed OTA module loader in the port, with an on/off switch in the port's settings
- Match recording in the PC tracker's format, replayable on PC
- Counting core ported to TypeScript and checked against the PC tracker on recorded matches
- Deck and opponent lists in the game's own card list: "left / total", bot decks from tesl-decks.com, modified copies, live updates
- "Count left only" setting in the port's settings screen
- The lists open from the game's own deck icons (release 7)
- Banished cards at the end of the game's graveyard lists, as on PC (release 8)
- Arena: the drafted deck is tracked (release 9)

**Next**
- Mana curve, created / stolen cards
- Cards that left the deck shown greyed (optional, as on PC)
- Deck archetypes, opponent profiles and the deck library, as on PC
- Restoring the count after a game restart mid-match; matches with the debug menu marked
- Match statistics and upload to tesl-decks.com

---

## Development

### Layout
- `src/core/` — the counting core. No Frida or IL2CPP dependencies, so it builds both for the phone and for tests in Node.
- `src/frida/` — the phone side: talks to the port's API (`globalThis.teslPort`), hooks game functions, draws the UI.
- `tests/` — Node tests (`node --test`).

### Commands
```sh
npm ci
npm test            # build the core for Node and run the tests
npm run build       # build/rdt.js, the module for the phone
```

### Releases
The ed25519 signing key lives only in the `RDT_SIGNING_KEY` GitHub Actions secret, never in the repository. Its public key is pinned in the port's loader:
`8e8414717e295a6fdafbe517c40cbea6d2b1fc73ed0bd910927e8edfa7d74700`

To release, run **Actions → release → Run workflow** on `main`. The workflow runs the tests, signs the build, checks the key against the pinned one and commits `release/`.

Manual release, with the key available locally:
```sh
node tools/keygen.mjs D:/keys/rdt-release.pem   # once; the public key goes into the port's loader
RDT_SIGNING_KEY=D:/keys/rdt-release.pem RDT_CHANNEL_BASE=https://raw.githubusercontent.com/<owner>/<repo>/main/release/ \
  node tools/release.mjs <revision>
```
This writes to `release/`:
- `manifest.json`: `{ revision, minCore, bytes, sha256, sig, url }`, where `sig` is an ed25519 signature over `"<sha256>:<revision>"`;
- `payloads/<sha256>.js`.

Commit and push `release/` to publish it. The loader contract is described in [docs/loader-contract.md](docs/loader-contract.md).

### Checking against the PC tracker
- `npm run schema -- <dump.cs>` regenerates `src/core/proto/schema.json`, the HistoryQueue schema (field numbers and types only, no game code).
- `node tools/dump-rec.mjs <file.rdtrec> [--json]` parses a recording: header, message count, event types (`--json` prints every message).
- `npm run golden` runs the core over reference recordings and compares the key log lines with the PC tracker's output. The references are real matches and stay local, in `tests/golden/` (not in git):
  - `tests/golden/<name>/recording.rdtrec`
  - `tests/golden/<name>/expected.txt`: the PC tracker's `replay-result.txt` for that recording
  - `tests/golden/cards.json`: card data.
