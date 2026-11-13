// Card data the tracking reads, from the PC tracker's cards.json export (GameData on PC, the Il2Cpp inventory on the phone).
// Mirrors GameData.MetaOf / InfoOf / NameOf / BaseAttribute / BaseFlag / DecodeDeckCode.

export interface CardRecord {
  id: string; baseId: string; inInventory: boolean; label: string;
  name?: string; color?: string; cost?: number; category?: number; unique?: boolean; prophecy?: boolean; avatar?: boolean; maxCopies?: number;
  infoName?: string; type?: string; colors?: string; infoAvatar?: boolean; infoCost?: number; attack?: number; health?: number; text?: string;
  baseManaCost?: number; baseAttack?: number; baseMaxHealth?: number; baseFlags?: string[]; exportCode?: string;
}
export type CardDb = Record<string, CardRecord>;

export interface CardMeta { BaseId: string; Name: string; Color: string; Cost: number; Category: number; Unique: boolean; Prophecy: boolean; Avatar: boolean }
export interface CardInfo { Name: string; Text: string; Avatar: boolean; Cost: number; Colors: string; Type: string }

// Where card records come from: the PC's cards.json in Node, the live game (frida/cardsource.ts) on the phone.
export interface CardSource {
  get(id: string): CardRecord | undefined;
  idOfCode(code: string): string | undefined;   // deck code (two letters) -> card id
}

export function dbSource(db: CardDb): CardSource {
  // the game's code table maps a code to the base card; alternates share their base's code
  const codeToId = new Map<string, string>();
  for (const c of Object.values(db)) {
    if (!c.exportCode || !c.inInventory) continue;
    if (!codeToId.has(c.exportCode) || c.id === c.baseId) codeToId.set(c.exportCode, c.id);
  }
  return { get: id => db[id], idOfCode: code => codeToId.get(code) };
}

export class Cards {
  private src: CardSource;
  constructor(source: CardDb | CardSource) {
    this.src = typeof (source as CardSource).get === "function" && typeof (source as CardSource).idOfCode === "function" ? source as CardSource : dbSource(source as CardDb);
  }
  private rec(id: string): CardRecord | undefined { return this.src.get(id); }

  // GameData.MetaOf: inventory cards only, with the base card's data
  meta(id: string): CardMeta | null {
    const c = this.rec(id);
    if (!c || !c.inInventory) return null;
    const b = this.rec(c.baseId) ?? c;
    return { BaseId: c.baseId, Name: b.name ?? b.label ?? "", Color: b.color ?? "", Cost: b.cost ?? -1, Category: b.category ?? 1,
      Unique: !!b.unique, Prophecy: !!b.prophecy, Avatar: !!b.avatar };
  }

  // GameData.InfoOf: the game's card data (tokens and bot cards too)
  info(id: string): CardInfo | null {
    const c = this.rec(id);
    if (!c) return null;
    return { Name: c.infoName ?? "", Text: c.text ?? "", Avatar: !!c.infoAvatar, Cost: c.infoCost ?? 0, Colors: c.colors ?? "", Type: c.type ?? "" };
  }

  keyOf(cardId: number): string { const m = this.meta(String(cardId)); return m ? m.BaseId : String(cardId); }

  // MatchTracker.CardLabel (precomputed in the export)
  label(key: string): string {
    const m = this.meta(key);
    if (m && m.Name.length > 0) return m.Name;
    const c = this.rec(key);
    return c?.label || c?.infoName || key;
  }

  baseAttribute(id: string, name: "ManaCost" | "Attack" | "MaxHealth"): number {
    const c = this.rec(id);
    if (!c) return -1;
    const v = name === "ManaCost" ? c.baseManaCost : name === "Attack" ? c.baseAttack : c.baseMaxHealth;
    return v ?? -1;
  }

  baseFlag(id: string, keyword: string): boolean { return !!this.rec(id)?.baseFlags?.includes(keyword); }

  // GameData.DecodeDeckCode: base card -> copies, or null; unknown codes are skipped
  decodeDeckCode(text: string): { cards: Map<string, number>; name: string; unknown: number } | null {
    const code = (text ?? "").trim();
    if (code.length < 8 || !code.startsWith("SP")) return null;
    const cards = new Map<string, number>();
    let pos = 2, unknown = 0;
    const isCount = (ch: string) => ch >= "A" && ch <= "Z";
    for (let copies = 1; copies < 9 && pos + 1 < code.length && isCount(code[pos]) && isCount(code[pos + 1]); copies++) {
      const n = (code.charCodeAt(pos) - 65) * 26 + (code.charCodeAt(pos + 1) - 65);
      pos += 2;
      if (n < 0 || n > 100) return null;
      for (let i = 0; i < n; i++) {
        if (pos + 1 >= code.length) return null;
        const key = code.substr(pos, 2);
        pos += 2;
        let id = this.src.idOfCode(key);
        if (!id) { unknown += copies; continue; }
        id = this.meta(id)?.BaseId ?? id;
        cards.set(id, (cards.get(id) ?? 0) + copies);
      }
    }
    let name = "";
    if (pos < code.length && (code[pos] === "~" || code[pos] === ":")) name = code.slice(pos + 1).trim().replace(/:+$/, "").trim();
    return cards.size > 0 ? { cards, name, unknown } : null;
  }
}
