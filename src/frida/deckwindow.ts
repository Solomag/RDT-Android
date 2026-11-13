// The deck window on the phone. Tapping your deck pile (or the opponent's) on the board opens the game's own card list
// (BoardConductor.ToggleGenericCardPicker, the list the graveyards open) with the tracker's cards: your deck's remaining
// copies, or the opponent's deck / seen cards. A second tap closes it. No buttons of our own: the piles are the buttons.
import type { Tracker } from "../core/tracker/tracker";
import type { TeslPort } from "./port";

const FakeUidBase = 900000;          // net uids of the shown cards (as on PC)
const PickerCustomUI = 3;            // MatchUI.CardListPickerType.CustomUI

const isNull = (o: any) => o == null || (o.handle && o.handle.isNull());


export interface DeckWindow { onMatch: () => void; onUpdate: () => void }

export function startDeckWindow(p: TeslPort, current: () => Tracker | null): DeckWindow {
  if (!p.frameGate) throw Error("the port has no frameGate");
  const image = p.img ?? Il2Cpp.domain.assembly("Assembly-CSharp").image;
  const klass = (name: string) => (p.cls ? p.cls(image, name) : image.class(name));
  const conductorClass = klass("SPTESL.BoardConductor");
  const clientCard = klass("SPTESL.ClientCard");
  const netUidClass = klass("SPTESL.CardNetUid");
  const gameManager = klass("SPTESL.GameManager");
  const pickerType = klass("SPTESL.MatchUI").nestedClasses.find((n: any) => n.name === "CardListPickerType");
  const listClass = Il2Cpp.corlib.class("System.Collections.Generic.List`1").inflate(clientCard);
  let errors = 0, builtFor = "";
  let board: any = null, matchUi: any = null, openSide: "deck" | "opp" | null = null;
  let shown = "", refreshDue = false, settleAt = 0;   // what the open list shows (to skip unchanged refreshes); a refresh is queued
  const fail = (what: string, e: any) => { if (errors++ < 5) p.log(`window: ${what} failed: ${e}`); };

  function boxed(k: any, field: string, value: number): any {
    const box = k.alloc();
    box.field(field).value = value;
    return box.unbox();
  }

  // fake net uid -> the label shown in the row's count (CardListItem.SetData is hooked below)
  const labels = new Map<number, string>();

  // fake net uids of modified copies: their names go green, as the game marks changed cards (and the PC does)
  const modified = new Set<number>();
  const attrClass = klass("SPTESL.AttributeType");

  function cardList(cards: [string, number, string, string][], t: Tracker): any {
    labels.clear();
    modified.clear();
    const list = listClass.alloc();
    list.method(".ctor", 0).invoke();
    const gm = gameManager.method("get_Instance").invoke();
    const getCard = gm.method("GetCard").overload("System.Int32");
    let fake = FakeUidBase;
    for (const [id, copies, label, mod] of cards) {
      const attrs = mod ? t.modAttributes(id, mod) : [];
      const card = getCard.invoke(Number(id));
      if (isNull(card)) continue;
      for (let i = 0; i < copies; i++) {
        const cc = clientCard.alloc();
        cc.method(".ctor").overload("SPTESL.Card").invoke(card);
        cc.method("set_NetUid").invoke(boxed(netUidClass, "Id", ++fake));
        labels.set(fake, label);
        if (attrs.length > 0) {
          // not yet seen on a phone: if setting the attributes fails, the copy still shows (plain), the list still opens
          try {
            for (const [attr, value] of attrs) cc.method("SetAttribute").invoke(boxed(attrClass, "value__", attr), value);
            const health = attrs.find(([a]) => a === 25);
            if (health) try { cc.method("set_CurrentHealth").invoke(health[1]); } catch (_) { /* no such setter */ }
            modified.add(fake);
          } catch (e) { fail("modified copy", e); }
        }
        list.method("Add").invoke(cc);
      }
    }
    return list;
  }

  function open(side: "deck" | "opp") {
    const t = current();
    if (!t) { p.log("window: no tracked deck yet"); return; }
    applySettings(); // the port's settings screen may have changed "count left only" since the last list
    if (isNull(board) || isNull(matchUi)) { p.log("window: no board"); return; }
    // the game's toggle reopens on a second tap: close it ourselves when our list for this side is the open one
    const active = matchUi.method("GetCardListPickerActive").invoke() === true;
    if (active) {
      matchUi.method("HideAndCleanupCardListPicker").invoke();
      if (openSide === side) { openSide = null; return; }
    }
    const cards = t.windowCards(side);
    board.method("ToggleGenericCardPicker").invoke(cardList(cards, t), boxed(pickerType, "value__", PickerCustomUI));
    openSide = side;
    shown = JSON.stringify(cards);
  }

  // After a tracked message: if our list is still open and its content changed, give the game's list the new cards in
  // place (MatchUI.SetCardListPickerData, the display form the graveyard uses: no usable ids, grouped, no selection).
  // 0.4.6 froze the game once, right after a match end, with this refresh in play: so now it never runs once the match
  // has ended, waits until the messages settle, reuses the tap path (hide + toggle, proven from the buttons) and marks
  // its start and end in Match.log, so a freeze shows where it stopped.
  function refresh() {
    refreshDue = false;
    if (!openSide || isNull(matchUi)) return;
    const live = current();
    if (!live || live.gameEnded) { openSide = null; return; }
    if (Date.now() < settleAt) { refreshDue = true; p.frameGate!("rdt window refresh", guarded); return; }
    if (matchUi.method("GetCardListPickerActive").invoke() !== true) { openSide = null; return; } // closed with its X
    // the game opened its own list over ours (a graveyard, a choice): not ours to refresh any more
    const type = matchUi.method("GetCardListPickerType").invoke();
    if (Number(typeof type === "number" ? type : type?.field?.("value__")?.value) !== PickerCustomUI) { openSide = null; return; }
    const t = current();
    if (!t) return;
    const cards = t.windowCards(openSide);
    const key = JSON.stringify(cards);
    if (key === shown) return;
    shown = key;
    t.log(`Window: refresh ${openSide} (${cards.length} rows)`);
    matchUi.method("HideAndCleanupCardListPicker").invoke();
    board.method("ToggleGenericCardPicker").invoke(cardList(cards, t), boxed(pickerType, "value__", PickerCustomUI));
    t.log("Window: refresh done");
  }
  const guarded = () => { try { refresh(); } catch (e) { refreshDue = false; fail("refresh", e); } };

  // window settings come from teslPort.settings ("rdt.*"); the port's own settings screen is where they are changed
  function applySettings() {
    current()?.setSettings({ countLeftOnly: p.settings?.get("rdt.countLeftOnly") === true });
  }

  // The deck piles on the board are the buttons, as on PC: the match UI keeps a 3D tooltip trigger per pile
  // (MatchUI._deckCountTooltips3d: [0] yours, [1] the opponent's). A tap on a pile reaches TooltipTrigger3D.OnMouseDown;
  // the game shows its count tooltip, and the module opens (or closes) the pile's list next to it.
  const pileSide = new Map<string, "deck" | "opp">();

  function build() {
    const boards = Il2Cpp.gc.choose(conductorClass);
    if (boards.length === 0) { p.log("window: no board yet"); return; }
    board = boards[boards.length - 1];
    const key = board.handle.toString();
    if (key === builtFor) return;
    matchUi = board.field("MatchUI_Mobile").value;
    if (isNull(matchUi)) matchUi = board.field("MatchUI_PC").value;
    if (isNull(matchUi)) { p.log("window: no match UI"); return; }
    openSide = null;
    pileSide.clear();
    const piles = matchUi.field("_deckCountTooltips3d").value;
    const n = isNull(piles) ? 0 : Number(piles.length);
    for (let i = 0; i < n && i < 2; i++) {
      const trigger = piles.get(i);
      if (!isNull(trigger)) pileSide.set(trigger.handle.toString(), i === 0 ? "deck" : "opp");
    }
    applySettings();
    builtFor = key;
    p.log(`window: deck piles ready (${pileSide.size})`);
  }

  const trigger3d = klass("TooltipTrigger3D");
  const mouseDown = trigger3d.methods.find((m: any) => m.name === "OnMouseDown" && m.parameterCount === 0);
  if (!mouseDown || mouseDown.virtualAddress.isNull()) throw Error("TooltipTrigger3D.OnMouseDown not found");
  {
    const attach = p.hookAttach ?? ((target: any, callbacks: any) => Interceptor.attach(target, callbacks));
    attach(mouseDown.virtualAddress, {
      onEnter(args: any) {
        const side = pileSide.get(args[0].toString());
        if (!side) return;
        // the game is in the middle of its own input: open on the next frame, outside this call. The pile's count
        // tooltip stays: hiding it (UnFire, 0.5.2) also stopped our list from showing.
        p.frameGate!("rdt deck pile", () => { try { open(side); } catch (e) { fail("open", e); } });
      },
    });
  }

  // the row's count: "left/total" like the PC instead of the game's plain count; single copies keep the game's look
  const item = klass("SPTESL.CardListItem");
  const setData = item.methods.find((m: any) => m.name === "SetData" && m.parameterCount === 1);
  if (setData && !setData.virtualAddress.isNull()) {
    const attach = p.hookAttach ?? ((target: any, callbacks: any) => Interceptor.attach(target, callbacks));
    attach(setData.virtualAddress, {
      onEnter(args: any) {
        (this as any).item = args[0];
        if (modified.size === 0) return;
        try {
          const data = new Il2Cpp.Object(args[1]);
          const cc = data.field("ClientCard").value;
          if (!isNull(cc) && modified.has(Number(cc.method("get_NetUid").invoke().field("Id").value)))
            data.field("OverrideNameColorHex").value = Il2Cpp.string("#7CFF5A");
        } catch (e) { fail("colour", e); }
      },
      onLeave() {
        if (labels.size === 0) return;
        try {
          const row = new Il2Cpp.Object((this as any).item);
          const cc = row.field("Data").value.field("ClientCard").value;
          if (isNull(cc)) return;
          const label = labels.get(Number(cc.method("get_NetUid").invoke().field("Id").value));
          if (label === undefined || label === "") return;
          const count = row.field("_count").value;
          if (!isNull(count)) count.method("set_text").invoke(Il2Cpp.string(label));
          const box = row.field("_countContainer").value;
          if (!isNull(box)) box.method("SetActive").invoke(true);
        } catch (e) { fail("count", e); }
      },
    });
  }

  p.log("window: on");
  return {
    onMatch() { p.frameGate!("rdt window", () => { try { build(); } catch (e) { fail("deck piles", e); } }); },
    // at most one refresh per frame, however many messages arrive
    onUpdate() {
      settleAt = Date.now() + 400; // a burst of messages (a turn change) refreshes once, after it
      if (!openSide || refreshDue) return;
      refreshDue = true;
      p.frameGate!("rdt window refresh", guarded);
    },
  };
}
