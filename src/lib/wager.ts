/** Wager helpers — custom stakes and (legacy) fractional odds */

/** @deprecated Legacy odds display only */
export function formatOdds(num: number, den: number): string {
  return `${num} to ${den}`;
}

/** Profit + stake returned if the line wins (legacy odds). */
export function payout(stake: number, oddsNum: number, oddsDen: number): number {
  if (!stake || !oddsNum || !oddsDen) return 0;
  return stake + (stake * oddsNum) / oddsDen;
}

/** Amount the opposing side puts up if this line hits (legacy odds). */
export function profit(stake: number, oddsNum: number, oddsDen: number): number {
  if (!stake || !oddsNum || !oddsDen) return 0;
  return (stake * oddsNum) / oddsDen;
}

/** Alias for UI copy (legacy odds). */
export function liability(
  stake: number,
  oddsNum: number,
  oddsDen: number
): number {
  return profit(stake, oddsNum, oddsDen);
}

export type WagerScope = "player" | "team";

/** @deprecated Use WagerScope */
export type OddsScope = WagerScope;

export type ScoringMode =
  | "higher_wins"
  | "lower_wins"
  | "placement"
  | "head_to_head"
  | "custom";

export type WagerMode = "none" | "pot" | "custom" | "odds";

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

export function wagerModeLabel(mode: string): string {
  switch (mode) {
    case "pot":
      return "Equal pot";
    case "custom":
      return "Custom wagers";
    case "odds":
      return "Odds (legacy)";
    case "none":
      return "No wager";
    default:
      return mode;
  }
}

/** Format a money amount for display (no currency symbol — IOU units as money). */
export function formatMoney(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
