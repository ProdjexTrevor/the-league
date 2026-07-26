export function formatOdds(num: number, den: number): string {
  return `${num} to ${den}`;
}

export function profit(stake: number, oddsNum: number, oddsDen: number): number {
  if (!stake || !oddsNum || !oddsDen) return 0;
  return (stake * oddsNum) / oddsDen;
}

export function liability(
  stake: number,
  oddsNum: number,
  oddsDen: number
): number {
  return profit(stake, oddsNum, oddsDen);
}

export type ScoringMode =
  | "higher_wins"
  | "lower_wins"
  | "placement"
  | "head_to_head"
  | "custom";

export function scoringModeLabel(mode: ScoringMode | string): string {
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
    default:
      return mode;
  }
}

export function wagerModeLabel(mode: string): string {
  switch (mode) {
    case "pot":
      return "Equal pot";
    case "custom":
      return "Custom wagers";
    case "odds":
      return "Odds";
    case "none":
      return "No wager";
    default:
      return mode;
  }
}
