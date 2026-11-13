// The deck window's content: modified copies carved out as their own rows (PC DeckEntries), and their attributes.
import test from "node:test";
import assert from "node:assert/strict";
import { Tracker, Cards } from "../build/core.mjs";

const db = {
  "100": { id: "100", baseId: "100", inInventory: true, label: "Sword Knight", name: "Sword Knight", cost: 4, category: 0, baseManaCost: 4, baseAttack: 3, baseMaxHealth: 3, baseFlags: [] },
  "200": { id: "200", baseId: "200", inInventory: true, label: "Fireball", name: "Fireball", cost: 2, category: 1, baseManaCost: 2, baseAttack: 0, baseMaxHealth: 0, baseFlags: [] },
};

test("modified deck copies get their own rows and attributes", () => {
  const t = new Tracker({ cards: new Cards(db) }, 1000);
  t.loadDeck(new Map([["100", 3], ["200", 2]]), "x");
  // a Sword Knight copy in the deck now costs 0 and is +2/+2 with Guard (its full state arrives while in the deck)
  const card = { CardNetUid: 77, CardId: 100, CreatorCardId: 0, PreviousGameZoneType: 2, IsPremium: false,
    CurrentPosition: { OwningPlayerUid: 1000, GameZoneName: 3 },
    AffectedAttributeName: [22, 24, 25, 29], AffectedAttributeValue: [0, 5, 5, 1] };
  t.processQueue({ Queue: [{ Type: 30025, ActingPlayerInstanceId: 1000, AffectedPlayersArray: [], AffectedCardsArray: [card], MatchIntroPlayers: [] }] });
  t.publish();
  assert.deepEqual(t.windowCards("deck"), [
    ["200", 2, "2/2", ""],
    ["100", 1, "", "cost 0, +2/+2, Guard"],
    ["100", 2, "2/2", ""],   // like the PC: the plain row counts what is not carved out
  ]);
  assert.deepEqual(t.modAttributes("100", "cost 0, +2/+2, Guard"), [[22, 0], [24, 5], [25, 5], [29, 1]]);
});
