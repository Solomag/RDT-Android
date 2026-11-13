// Card records read from the live game, the same fields the PC's cards.json export carries (PC GameData.MetaOf, InfoOf,
// NameOf, BaseAttribute, BaseFlag, CleanCardText), built lazily per card id and cached.
//   inventory side: ServicesManager.Inventory.CardTypeLookup[id] (Inventory.CardType, ClientCardData)
//   game side: SPTESL.GameManager.Instance.GetCard(id) (SPTESL.Card: Name, Subtypes, Get*Attribute, description)
import type { CardRecord, CardSource } from "../core/tracker/cards";
import type { TeslPort } from "./port";

const ATTR = { ManaCost: 22, Attack: 24, MaxHealth: 25 };
const KEYWORDS: [string, number][] = [["Charge", 28], ["Taunt", 29], ["Cover", 30], ["Deathtouch", 31], ["Breakthrough", 46], ["Ward", 47], ["Regenerate", 48], ["Drain", 70]];
const COLORS = ["Strength", "Intelligence", "Willpower", "Agility", "Endurance"];
const TRACKED = ["Creature", "Avatar", "Item", "Spell", "Shout", "Support", "HasAction", "HasAbility", "Prophecy", "Unknown"];

const isNull = (o: any) => o == null || (o.handle && o.handle.isNull());
const num = (v: any): number => (typeof v === "number" ? v : Number(v?.field?.("value__")?.value ?? v));
const str = (v: any): string => (v == null ? "" : typeof v === "string" ? v : String(v.content ?? ""));

export function gameCardSource(p: TeslPort, log: (m: string) => void): CardSource {
  const image = p.img ?? Il2Cpp.domain.assembly("Assembly-CSharp").image;
  const klass = (name: string) => (p.cls ? p.cls(image, name) : image.class(name));
  const services = klass("SparkleServices.ServicesManager");
  const gameManager = klass("SPTESL.GameManager");
  let textUtils: any = null;
  try { textUtils = klass("SPTESL.DynamicTextUtilities"); } catch (_) { log("cards: no DynamicTextUtilities, raw descriptions"); }
  const attrClass = klass("SPTESL.AttributeType");
  const nested = (outer: string, ...path: string[]) => {
    let k = klass(outer);
    for (const name of path) k = k.nestedClasses.find((n: any) => n.name === name);
    return k;
  };
  // enum names from the game, the dump's values as the fallback (ColorSubType is nested: Inventory.CardType.ColorSubType)
  const subtypeNames = enumNames(() => klass("SPTESL.CardSubtype"), CARD_SUBTYPES);
  const colorNames = enumNames(() => nested("Inventory", "CardType", "ColorSubType"), ["None", "Strength", "Intelligence", "Willpower", "Agility", "Endurance", "Neutral"]);
  const describe = textUtils?.methods.find((m: any) => m.name === "GetFixedUpCardDescription" && m.parameterCount === 1 && m.parameters[0].type.name === "SPTESL.Card");
  const cache = new Map<string, CardRecord | null>();
  let codeTable: any = null;
  let failures = 0;

  function inventory(): any { return services.method("get_Instance").invoke().field("Inventory").value; }

  function attr(n: number): any {
    const box = attrClass.alloc();
    box.field("value__").value = n;
    return box.unbox();
  }

  function listOf(list: any): any[] {
    if (isNull(list)) return [];
    const n = Number(list.method("get_Count").invoke()), out: any[] = [];
    for (let i = 0; i < n; i++) out.push(list.method("get_Item").invoke(i));
    return out;
  }

  function build(id: string): CardRecord | null {
    const hash = Number(id);
    if (!Number.isInteger(hash)) return null;
    const rec: CardRecord = { id, baseId: id, inInventory: false, label: "" };
    // inventory meta (MetaOf: the base card's data for any art)
    const inv = inventory();
    const types = inv.method("get_CardTypeLookup").invoke();
    if (!isNull(types) && types.method("ContainsKey").invoke(hash)) {
      const type = types.method("get_Item").invoke(hash);
      const alt = Number(type.field("AlternateOfCardTypeHash").value);
      const base = alt && types.method("ContainsKey").invoke(alt) ? types.method("get_Item").invoke(alt) : type;
      rec.inInventory = true;
      rec.baseId = String(alt || hash);
      const data = base.field("ClientCardData").value;
      rec.name = str(data.field("Name").value) || str(base.field("TypeName").value);
      rec.color = listOf(base.field("ColorSubTypes").value).map(v => colorNames.get(num(v)) ?? "").filter(c => c && c !== "Neutral" && c !== "None").join("/");
      rec.cost = Number(data.field("ManaCost").value);
      const tracked = listOf(data.field("TrackedSubTypes").value).map(v => TRACKED[num(v)] ?? "");
      rec.category = tracked.includes("Creature") ? 0 : tracked.includes("Item") ? 3 : tracked.includes("Support") ? 2 : 1;
      rec.unique = data.field("Unique").value === true;
      rec.prophecy = tracked.includes("Prophecy");
      rec.avatar = tracked.includes("Avatar");
    }
    // game card (InfoOf, BaseAttribute, BaseFlag)
    const card = gameManager.method("get_Instance").invoke().method("GetCard").overload("System.Int32").invoke(hash);
    if (!isNull(card)) {
      rec.infoName = str(card.field("Name").value);
      const type: string[] = [], races: string[] = [], colors: string[] = [];
      let creature = false;
      for (const v of listOf(card.field("Subtypes").value)) {
        const name = subtypeNames.get(num(v)) ?? "";
        if (COLORS.includes(name)) colors.push(name);
        if (name === "Avatar") rec.infoAvatar = true;
        if (name === "Creature") creature = true;
        if (["Creature", "Item", "Support", "Avatar"].includes(name)) type.push(name);
        else if (name === "Spell" || name === "Shout") { if (type.length === 0) type.push("Action"); }
        else if (name.length > 0 && !["Double", "HasAction", "HasAbility", "Neutral", ...COLORS].includes(name)) races.push(name.replace(/_/g, " "));
      }
      rec.type = type.join(", ") + (races.length > 0 ? ` - ${races.join(" ")}` : "");
      rec.colors = colors.join("/");
      const intAttr = (n: number) => { try { return Number(card.method("GetIntegerAttribute").invoke(attr(n))); } catch (_) { return -1; } };
      rec.infoCost = rec.baseManaCost = intAttr(ATTR.ManaCost);
      rec.baseAttack = intAttr(ATTR.Attack);
      rec.baseMaxHealth = intAttr(ATTR.MaxHealth);
      rec.attack = creature || rec.baseAttack > 0 ? rec.baseAttack : -1;
      rec.health = creature || rec.baseAttack > 0 ? rec.baseMaxHealth : -1;
      let raw = "";
      try { raw = describe ? str(describe.invoke(card)) : str(card.field("Description").value); } catch (_) { raw = str(card.field("Description").value); }
      rec.text = cleanCardText(raw);
      rec.baseFlags = [];
      for (const [name, n] of KEYWORDS) {
        let on = false;
        try { on = card.method("GetBoolAttribute").invoke(attr(n)) === true; } catch (_) { /* int fallback */ }
        if (on || intAttr(n) > 0) rec.baseFlags.push(name);
      }
    }
    if (!rec.inInventory && isNull(card)) return null;
    rec.label = (rec.inInventory ? rec.name : "") || rec.infoName || id;
    return rec;
  }

  return {
    get(id: string) {
      if (cache.has(id)) return cache.get(id) ?? undefined;
      let rec: CardRecord | null = null;
      try { rec = build(id); } catch (e) { if (failures++ < 5) log(`cards: ${id} unreadable: ${e}`); }
      cache.set(id, rec);
      return rec ?? undefined;
    },
    idOfCode(code: string) {
      try {
        const inv = inventory();
        if (isNull(inv.field("_inventoryDescription").value)) return undefined; // see recorder.ts: never build the tables early
        if (isNull(codeTable)) codeTable = inv.method("get_CodeToHashLookup").invoke();
        if (isNull(codeTable) || !codeTable.method("ContainsKey").invoke(Il2Cpp.string(code))) return undefined;
        return String(codeTable.method("get_Item").invoke(Il2Cpp.string(code)));
      } catch (_) { return undefined; }
    },
  };
}

function enumNames(find: () => any, fallback: string[]): Map<number, string> {
  const names = new Map<number, string>();
  try { for (const f of find().fields) if (f.isLiteral) names.set(num(f.value), f.name); } catch (_) { /* fallback below */ }
  if (names.size === 0) fallback.forEach((n, i) => names.set(i, n));
  return names;
}

// SPTESL.CardSubtype as in the dump (0..76); the game's own table wins when readable
const CARD_SUBTYPES = ("Creature Avatar Item Spell Shout Support Double HasAction HasAbility Strength Intelligence Willpower Agility Endurance Neutral " +
  "Abomination Animated_Item Argonian Ash_Creature Atronach Automaton Ayelid Baliwog Beast Breton Centaur Chaurus Daedra Dark_Elf Defense Dragon " +
  "Dreugh Dwemer Egg Elytra Fabricant Factotum Falmer Fish Fyr Gargoyle Giant Gnarl Goblin God Grummite Harpy High_Elf Insect Imp Imperial Khajiit " +
  "Kwama Lurcher Mammoth Mantikora Minotaur Mudcrab Mummy Nereid Netch Nord Ogre Orc Pastry Portal Reachman Redguard Reptile Scalon Skeever " +
  "Skeleton Spider Spirit Spriggan Trap Troll").split(" ");

// PC GameData.CleanCardText: keep only <b>, <i>, <color> tags; "\n" escapes become newlines.
export function cleanCardText(text: string): string {
  if (text.length === 0) return text;
  let out = "", i = 0;
  while (i < text.length) {
    if (text[i] === "<") {
      const end = text.indexOf(">", i);
      if (end > i) {
        const tag = text.slice(i + 1, end).toLowerCase().replace(/^\/+/, "");
        if (tag === "b" || tag === "i" || tag.startsWith("color")) out += text.slice(i, end + 1);
        i = end + 1;
        continue;
      }
    }
    out += text[i++];
  }
  return out.split("\\n").join("\n").trim();
}
