// M5 step 2: the deck window on the phone. Tapping your deck (or the opponent's) opens the game's own card list
// (BoardConductor.ToggleGenericCardPicker, the list the graveyard buttons open) with the tracker's cards: your deck's
// remaining copies, or the opponent's deck / seen cards. Like the PC (MatchTracker.NativeHud HookDeckButton): the deck
// button is made tappable, except while the game itself wants it (choosing from the deck), when it stays the game's.
import type { Tracker } from "../core/tracker/tracker";
import type { TeslPort } from "./port";

const FakeUidBase = 900000;          // net uids of the shown cards (as on PC)
const PickerCustomUI = 3;            // MatchUI.CardListPickerType.CustomUI
const OwnerPlayer = 0;               // PlayerControllerType.Player

const isNull = (o: any) => o == null || (o.handle && o.handle.isNull());

export function startDeckWindow(p: TeslPort, current: () => Tracker | null): void {
  const image = p.img ?? Il2Cpp.domain.assembly("Assembly-CSharp").image;
  const klass = (name: string) => (p.cls ? p.cls(image, name) : image.class(name));
  const conductor = klass("SPTESL.BoardConductor");
  const panel = klass("PlayerInfoPanel");
  const clientCard = klass("SPTESL.ClientCard");
  const netUidClass = klass("SPTESL.CardNetUid");
  const gameManager = klass("SPTESL.GameManager");
  const pickerType = klass("SPTESL.MatchUI").nestedClasses.find((n: any) => n.name === "CardListPickerType");
  const buttonClass = p.ucls ? p.ucls("UnityEngine.UI.Button") : null;
  const listClass = Il2Cpp.corlib.class("System.Collections.Generic.List`1").inflate(clientCard);
  const attach = p.hookAttach ?? ((target: any, callbacks: any) => Interceptor.attach(target, callbacks));
  const method = (k: any, name: string, params: number) => {
    const m = k.methods.find((x: any) => x.name === name && x.parameterCount === params);
    if (!m || m.virtualAddress.isNull()) throw Error(`${k.name}.${name} not found`);
    return m;
  };
  let gameWants = false, errors = 0;
  const fail = (what: string, e: any) => { if (errors++ < 5) p.log(`window: ${what} failed: ${e}`); };

  function boxed(k: any, field: string, value: number): any {
    const box = k.alloc();
    box.field(field).value = value;
    return box.unbox();
  }

  // the deck button stays tappable (the game only enables it for its own deck choices)
  function makeTappable(infoPanel: any) {
    if (!buttonClass) return;
    const go = infoPanel.field("_deckBtn").value;
    if (isNull(go)) return;
    const button = go.method("GetComponent", 1).overload("System.Type").invoke(buttonClass.type.object);
    if (!isNull(button) && button.method("get_interactable").invoke() !== true) button.method("set_interactable").invoke(true);
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

  attach(method(panel, "SetData", 1).virtualAddress, {
    onEnter(args: any) { (this as any).panel = args[0]; },
    onLeave() { try { makeTappable(new Il2Cpp.Object((this as any).panel)); } catch (e) { fail("deck button", e); } },
  });
  attach(method(panel, "SetPlayerDeckIconInteract", 1).virtualAddress, {
    onEnter(args: any) { (this as any).panel = args[0]; (this as any).can = (args[1].toInt32() & 0xff) !== 0; },
    onLeave() {
      gameWants = (this as any).can;
      try { makeTappable(new Il2Cpp.Object((this as any).panel)); } catch (e) { fail("deck button", e); }
    },
  });
  attach(method(conductor, "HandleOnDeckIconPressed", 1).virtualAddress, {
    onEnter(args: any) {
      if (gameWants) return; // the game is choosing from the deck: its button
      try {
        const t = current();
        const owner = args[1].toInt32();
        if (!t) { p.log("window: no tracked deck yet"); return; }
        const cards = t.windowCards(owner === OwnerPlayer ? "deck" : "opp");
        const board = new Il2Cpp.Object(args[0]);
        board.method("ToggleGenericCardPicker").invoke(cardList(cards), boxed(pickerType, "value__", PickerCustomUI));
      } catch (e) { fail("open", e); }
    },
  });
  p.log("window: deck buttons on");
}
