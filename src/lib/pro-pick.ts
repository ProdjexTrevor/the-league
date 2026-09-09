export type ProPickSide = "home" | "away" | "over" | "under";
export type ProPickMarket = "moneyline" | "spread" | "total" | "game";

export type ProPick = {
  espnEventId: string;
  sport: string;
  marketKind: ProPickMarket;
  /** Side the bet creator took. Null for ungradable “game only” picks. */
  side: ProPickSide | null;
  /** Spread for that side, or the total number. */
  lineValue: number | null;
  home: string;
  away: string;
  homeAbbr: string;
  awayAbbr: string;
  marketLabel: string;
  pickerUserId: string;
  /** ISO kickoff — recon starts after sport-specific delay. */
  startIso?: string | null;
  graded?: boolean;
  result?: "win" | "loss" | "push" | "ungradable";
  finalHome?: number;
  finalAway?: number;
  gradedAt?: string;
  note?: string;
};

/** Hours after kickoff before we start polling ESPN for a final. */
export function reconDelayHours(sport: string): number {
  switch (sport) {
    case "nfl":
    case "ncaaf":
      return 3;
    case "nba":
    case "ncaab":
      return 2.5;
    case "mlb":
      return 3;
    case "nhl":
      return 2.5;
    default:
      return 3;
  }
}

/** True when we're in the post-game window and should hit ESPN. */
export function isInReconWindow(
  pick: ProPick,
  now = new Date()
): boolean {
  if (!pick.startIso) {
    // Legacy picks without kickoff — allow recon (hourly / every tick).
    return true;
  }
  const start = new Date(pick.startIso);
  if (Number.isNaN(+start)) return true;
  const delayMs = reconDelayHours(pick.sport) * 60 * 60 * 1000;
  return now.getTime() >= start.getTime() + delayMs;
}

export function normalizeProPick(raw: unknown): ProPick | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.espnEventId !== "string" || !o.espnEventId) return null;
  if (typeof o.sport !== "string") return null;
  if (typeof o.pickerUserId !== "string") return null;
  const marketKind = o.marketKind as ProPickMarket;
  if (!["moneyline", "spread", "total", "game"].includes(marketKind)) return null;
  return {
    espnEventId: o.espnEventId,
    sport: o.sport,
    marketKind,
    side: (o.side as ProPickSide | null) ?? null,
    lineValue:
      o.lineValue == null || o.lineValue === ""
        ? null
        : Number(o.lineValue),
    home: String(o.home ?? "Home"),
    away: String(o.away ?? "Away"),
    homeAbbr: String(o.homeAbbr ?? "HOME"),
    awayAbbr: String(o.awayAbbr ?? "AWAY"),
    marketLabel: String(o.marketLabel ?? ""),
    pickerUserId: o.pickerUserId,
    startIso: typeof o.startIso === "string" ? o.startIso : null,
    graded: Boolean(o.graded),
    result: o.result as ProPick["result"],
    finalHome: o.finalHome == null ? undefined : Number(o.finalHome),
    finalAway: o.finalAway == null ? undefined : Number(o.finalAway),
    gradedAt: typeof o.gradedAt === "string" ? o.gradedAt : undefined,
    note: typeof o.note === "string" ? o.note : undefined,
  };
}

/** Grade the picker’s side against a final score. */
export function gradeProPick(
  pick: ProPick,
  homeScore: number,
  awayScore: number
): "win" | "loss" | "push" | "ungradable" {
  if (!pick.side || pick.marketKind === "game") return "ungradable";

  if (pick.marketKind === "moneyline") {
    if (homeScore === awayScore) return "push";
    const homeWon = homeScore > awayScore;
    const pickHit =
      (pick.side === "home" && homeWon) || (pick.side === "away" && !homeWon);
    return pickHit ? "win" : "loss";
  }

  if (pick.marketKind === "spread") {
    if (pick.lineValue == null || Number.isNaN(pick.lineValue)) return "ungradable";
    const margin =
      pick.side === "home"
        ? homeScore + pick.lineValue - awayScore
        : awayScore + pick.lineValue - homeScore;
    if (Math.abs(margin) < 1e-9) return "push";
    return margin > 0 ? "win" : "loss";
  }

  if (pick.marketKind === "total") {
    if (pick.lineValue == null || Number.isNaN(pick.lineValue)) return "ungradable";
    const total = homeScore + awayScore;
    if (Math.abs(total - pick.lineValue) < 1e-9) return "push";
    if (pick.side === "over") return total > pick.lineValue ? "win" : "loss";
    if (pick.side === "under") return total < pick.lineValue ? "win" : "loss";
    return "ungradable";
  }

  return "ungradable";
}

export function parseLineNumber(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const m = String(raw).match(/[+-]?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}
