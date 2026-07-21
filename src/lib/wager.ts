/** Fractional odds helpers: "2 to 1" => num=2, den=1 */

export function formatOdds(num: number, den: number): string {
  return `${num} to ${den}`;
}

/** Profit + stake returned if the line wins. */
export function payout(stake: number, oddsNum: number, oddsDen: number): number {
  if (!stake || !oddsNum || !oddsDen) return 0;
  return stake + (stake * oddsNum) / oddsDen;
}

export function profit(stake: number, oddsNum: number, oddsDen: number): number {
  if (!stake || !oddsNum || !oddsDen) return 0;
  return (stake * oddsNum) / oddsDen;
}

export type ScoringMode =
  | "higher_wins"
  | "lower_wins"
  | "placement"
  | "head_to_head"
  | "custom";

export type WagerMode = "none" | "pot" | "odds";

export type EventKind = "game" | "tournament";

export function scoringModeLabel(mode: ScoringMode): string {
  switch (mode) {
    case "higher_wins":
      return "Higher score wins";
    case "lower_wins":
      return "Lower score wins";
    case "placement":
      return "Placement (1 = winner)";
    case "head_to_head":
      return "Head to head (W/L/D)";
    case "custom":
      return "Custom";
  }
}
