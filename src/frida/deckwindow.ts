// M5 step 2: the deck window on the phone. The mobile board has no deck button (the deck pile is a 3D object that shows a
// tooltip), so the module adds two small buttons, "Deck" and "Opp", to the match UI (port's ui helpers). They open the
// game's own card list (BoardConductor.ToggleGenericCardPicker, the list the graveyards open) with the tracker's cards:
// your deck's remaining copies, or the opponent's deck / seen cards. A second tap closes it.
import type { Tracker } from "../core/tracker/tracker";
import type { TeslPort } from "./port";

const FakeUidBase = 900000;          // net uids of the shown cards (as on PC)
const PickerCustomUI = 3;            // MatchUI.CardListPickerType.CustomUI

const isNull = (o: any) => o == null || (o.handle && o.handle.isNull());

export interface DeckWindow { onMatch: () => void }

export function startDeckWindow(p: TeslPort, current: () => Tracker | null): DeckWindow {
  if (!p.ui || !p.frameGate) throw Error("the port has no ui helpers");
  const ui = p.ui;
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
  const fail = (what: string, e: any) => { if (errors++ < 5) p.log(`window: ${what} failed: ${e}`); };

  function boxed(k: any, field: string, value: number): any {
    const box = k.alloc();
    box.field(field).value = value;
    return box.unbox();
  }

  function cardList(cards: [string, number][]): any {
    const list = listClass.alloc();
    list.method(".ctor", 0).invoke();
    const gm = gameManager.method("get_Instance").invoke();
    const getCard = gm.method("GetCard").overload("System.Int32");
    let fake = FakeUidBase;
    for (const [id, copies] of cards) {
      const card = getCard.invoke(Number(id));
      if (isNull(card)) continue;
      for (let i = 0; i < copies; i++) {
        const cc = clientCard.alloc();
        cc.method(".ctor").overload("SPTESL.Card").invoke(card);
        cc.method("set_NetUid").invoke(boxed(netUidClass, "Id", ++fake));
        list.method("Add").invoke(cc);
      }
    }
    return list;
  }

  function open(side: "deck" | "opp") {
    const t = current();
    if (!t) { p.log("window: no tracked deck yet"); return; }
    if (isNull(board) || isNull(matchUi)) { p.log("window: no board"); return; }
    // the game's toggle reopens on a second tap: close it ourselves when our list for this side is the open one
    const active = matchUi.method("GetCardListPickerActive").invoke() === true;
    if (active) {
      matchUi.method("HideAndCleanupCardListPicker").invoke();
      if (openSide === side) { openSide = null; return; }
    }
    board.method("ToggleGenericCardPicker").invoke(cardList(t.windowCards(side)), boxed(pickerType, "value__", PickerCustomUI));
    openSide = side;
  }

  // a button the size of a finger: dark plate, gold text, on the right edge between the magicka gem and the graveyard
  function button(name: string, parent: any, text: string, y: number, action: () => void) {
    const go = ui.uiNew(name, parent);
    ui.uiPlace(go, 1, 1, 1, 0.5, -16, y, 150, 64);
    const bg = ui.uiAdd(go, "UnityEngine.UI.Image");
    bg.method("set_color").invoke(color(0.08, 0.07, 0.06, 0.85));
    const label = ui.uiNew("Label", go.method("get_transform").invoke());
    ui.uiStretch(ui.uiRect(label));
    const tmp = ui.uiText(label, text, 30);
    tmp.method("set_color").invoke(color(1, 0.82, 0.35, 1));
    ui.uiButton(go, bg, () => { try { action(); } catch (e) { fail("open", e); } });
  }

  function color(r: number, g: number, b: number, a: number): any {
    const c = p.ucls!("UnityEngine.Color").alloc();
    c.field("r").value = r; c.field("g").value = g; c.field("b").value = b; c.field("a").value = a;
    return c.unbox();
  }

  // once per match (the board and its UI are new each match): find the board, put the buttons on its match UI
  function build() {
    const boards = Il2Cpp.gc.choose(conductorClass);
    if (boards.length === 0) { p.log("window: no board yet"); return; }
    board = boards[boards.length - 1];
    const key = board.handle.toString();
    if (key === builtFor) return;
    matchUi = board.field("MatchUI_Mobile").value;
    if (isNull(matchUi)) matchUi = board.field("MatchUI_PC").value;
    if (isNull(matchUi)) { p.log("window: no match UI"); return; }
    const parent = matchUi.method("get_transform").invoke();
    openSide = null;
    button("RdtOppButton", parent, "Opp", -300, () => open("opp"));
    button("RdtDeckButton", parent, "Deck", -380, () => open("deck"));
    builtFor = key;
    p.log("window: buttons added");
  }

  p.log("window: on");
  return {
    onMatch() { p.frameGate!("rdt window", () => { try { build(); } catch (e) { fail("buttons", e); } }); },
  };
}
