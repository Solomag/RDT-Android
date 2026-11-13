// The deck window on the phone, as on PC: the game's deck button (your panel's or the opponent's) opens the game's own card
// list (BoardConductor.ToggleGenericCardPicker, the list the graveyards open) with the tracker's cards: your deck's
// remaining copies, or the opponent's deck / seen cards. A second tap closes it. No buttons of our own.
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

  // The deck buttons, as on PC (MatchTracker.NativeHud HookDeckButton): PlayerInfoPanel._deckBtn of the player's and the
  // opponent's panel (Btn_Deck_Player / Btn_Deck_Opponent, the card icons in the right-hand column on the phone). On the
  // phone the game only uses them as tooltip anchors: no graphic, so taps never reach them. The module gives each a
  // transparent Image as its raycast target, keeps it interactable and adds a click that opens / closes that side's list.
  // While the game wants the button itself (choosing from the deck: SetPlayerDeckIconInteract(true)), the click is the game's.
  const buttonClass = p.ucls!("UnityEngine.UI.Button");
  const imageClass = p.ucls!("UnityEngine.UI.Image");
  const actionClass = p.ucls!("UnityEngine.Events.UnityAction");
  const panelClass = klass("PlayerInfoPanel");
  const gameWants = new Map<string, boolean>();   // deck button object -> the game enabled it for its own choice
  const keep: any[] = [];                          // the click delegates live as long as the module

  function component(go: any, k: any): any {
    return go.method("GetComponent", 1).overload("System.Type").invoke(k.type.object);
  }

  function color(r: number, g: number, b: number, a: number): any {
    const c = p.ucls!("UnityEngine.Color").alloc();
    c.field("r").value = r; c.field("g").value = g; c.field("b").value = b; c.field("a").value = a;
    return c.unbox();
  }

  const canvasClass = p.ucls!("UnityEngine.Canvas");
  function aboveList(go: any) {
    const picker = matchUi.field("_cardListPicker").value;
    let order = 0;
    if (!isNull(picker)) {
      const pc = picker.method("GetComponentInParent", 1).overload("System.Type").invoke(canvasClass.type.object);
      if (!isNull(pc)) order = Number(pc.method("get_sortingOrder").invoke());
    }
    let canvas = component(go, canvasClass);
    if (isNull(canvas)) canvas = go.method("AddComponent").overload("System.Type").invoke(canvasClass.type.object);
    canvas.method("set_overrideSorting").invoke(true);
    canvas.method("set_sortingOrder").invoke(order + 1);
    const raycaster = p.ucls!("UnityEngine.UI.GraphicRaycaster");
    if (isNull(component(go, raycaster))) go.method("AddComponent").overload("System.Type").invoke(raycaster.type.object);
  }

  function deckButton(panel: any, side: "deck" | "opp") {
    if (isNull(panel)) return false;
    const go = panel.field("_deckBtn").value;
    if (isNull(go)) return false;
    const button = component(go, buttonClass);
    if (isNull(button)) return false;
    if (isNull(component(go, imageClass))) {
      const image = go.method("AddComponent").overload("System.Type").invoke(imageClass.type.object);
      image.method("set_color").invoke(color(1, 1, 1, 0));
      image.method("set_raycastTarget").invoke(true);
      button.method("set_targetGraphic").invoke(image);
    }
    button.method("set_interactable").invoke(true);
    // the open list spans the right-hand icon column: the icon gets its own canvas one step above the list's, so it
    // stays visible and tappable over it (a second tap closes, the other icon switches)
    try { aboveList(go); } catch (e) { fail("deck button order", e); }
    const key = go.handle.toString();
    const click = Il2Cpp.delegate(actionClass, () => {
      if (gameWants.get(key)) return; // the game is choosing from the deck: its button
      try { open(side); } catch (e) { fail("open", e); }
    });
    keep.push(click);
    button.method("get_onClick").invoke().method("AddListener").invoke(click);
    return true;
  }

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
    const mine = deckButton(matchUi.field("_myInfoPanel").value, "deck");
    const theirs = deckButton(matchUi.field("_urInfoPanel").value, "opp");
    applySettings();
    builtFor = key;
    p.log(`window: deck buttons ${mine ? "on" : "missing"} / ${theirs ? "on" : "missing"}`);
  }

  // the game enables the deck button only for its own deck choices; afterwards it stays tappable for the list
  {
    const interact = panelClass.methods.find((m: any) => m.name === "SetPlayerDeckIconInteract" && m.parameterCount === 1);
    if (interact && !interact.virtualAddress.isNull()) {
      const attach = p.hookAttach ?? ((target: any, callbacks: any) => Interceptor.attach(target, callbacks));
      attach(interact.virtualAddress, {
        onEnter(args: any) { (this as any).panel = args[0]; (this as any).can = (args[1].toInt32() & 0xff) !== 0; },
        onLeave() {
          try {
            const go = new Il2Cpp.Object((this as any).panel).field("_deckBtn").value;
            if (isNull(go)) return;
            gameWants.set(go.handle.toString(), (this as any).can);
            const button = component(go, buttonClass);
            if (!isNull(button)) button.method("set_interactable").invoke(true);
          } catch (e) { fail("deck button state", e); }
        },
      });
    }
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
    onMatch() { p.frameGate!("rdt window", () => { try { build(); } catch (e) { fail("deck buttons", e); } }); },
    // at most one refresh per frame, however many messages arrive
    onUpdate() {
      settleAt = Date.now() + 400; // a burst of messages (a turn change) refreshes once, after it
      if (!openSide || refreshDue) return;
      refreshDue = true;
      p.frameGate!("rdt window refresh", guarded);
    },
  };
}
