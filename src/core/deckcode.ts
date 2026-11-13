// Deck code in the game's export format, same as the PC's GameData.DeckCode:
// "SP", then for each copy count 1..max(3, highest) a two-letter A-Z count and that many two-letter card codes.
// Counts are per base card (alternate arts folded into their base). "" when a card has no code or a count is out of 1..8.
export function deckCode(countsByBase: Map<number, number>, codeOf: (hash: number) => string | undefined): string {
  const byCount: string[][] = Array.from({ length: 9 }, () => []);
  let max = 3;
  for (const [hash, count] of countsByBase) {
    const code = codeOf(hash);
    if (!code || count <= 0 || count >= 9) return "";
    max = Math.max(max, count);
    byCount[count].push(code);
  }
  let out = "SP";
  for (let count = 1; count <= max; count++) {
    const n = byCount[count].length;
    out += String.fromCharCode(65 + Math.floor(n / 26), 65 + (n % 26)) + byCount[count].join("");
  }
  return out;
}
