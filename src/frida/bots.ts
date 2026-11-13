// Bot decks (tesl-decks.com /tracker/bots-v1.json), as the PC's Uploader.SendBots / BotDecks: a local copy in the
// module's folder, refreshed once per game start. Public data, no account or token involved.
import { utf8Decode } from "../core/rdtrec";
import type { BotDecks } from "../core/tracker/tracker";
import type { TeslPort } from "./port";

// the main site first; the file lives on dev for now (the PC tracker's BaseUrl)
const URLS = ["https://tesl-decks.com/tracker/bots-v1.json", "https://dev.tesl-decks.com/tracker/bots-v1.json"];

export function startBots(p: TeslPort): () => BotDecks | undefined {
  const file = p.dataDir ? `${p.dataDir}/bots-v1.json` : "";
  let bots: BotDecks | undefined;
  const use = (text: string, from: string) => {
    const data = JSON.parse(text);
    if (!data || typeof data.decks !== "object") throw Error("no decks");
    bots = data;
    p.log(`bots: ${Object.keys(data.decks).length} bot decks (${from})`);
  };
  try { if (file) use((File as any).readAllText(file), "saved copy"); } catch (_) { /* none yet */ }
  if (p.httpGetBytes) {
    const fetch = (i: number) => {
      if (i >= URLS.length) return;
      p.httpGetBytes!(URLS[i]).then(bytes => {
        const text = utf8Decode(bytes);
        use(text, URLS[i].replace("https://", "").split("/")[0]);
        if (file) try { const f = new File(file, "wb"); f.write(text); f.flush(); f.close(); } catch (e) { p.log(`bots: not saved (${e})`); }
      }).catch(() => fetch(i + 1));
    };
    fetch(0);
  }
  return () => bots;
}
