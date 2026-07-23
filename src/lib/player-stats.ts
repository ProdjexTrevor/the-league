import { eventKindLabel, formatMoney } from "@/lib/wager";

export type PlayerEventRow = {
  event_id: string;
  user_id: string;
  outcome: string | null;
  placement: number | null;
  units_delta: number | string;
  invite_status: string;
};

export type PlayerEventMeta = {
  id: string;
  title: string;
  kind: string;
  status: string;
  catalog_id: string;
  played_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CatalogName = { id: string; name: string; slug: string };

export type MoneyRival = {
  userId: string;
  displayName: string;
  amount: number;
};

export type GameWinStat = {
  catalogId: string;
  name: string;
  wins: number;
  played: number;
  losses: number;
};

export type HistoryItem = {
  eventId: string;
  title: string;
  kind: string;
  kindLabel: string;
  status: string;
  catalogName: string;
  outcomeLabel: string;
  unitsDelta: number;
  when: string;
};

export type PlayerDashboard = {
  played: number;
  wins: number;
  losses: number;
  draws: number;
  moneyWon: number;
  moneyLost: number;
  netMoney: number;
  winRate: number | null;
  biggestWin: number;
  biggestLoss: number;
  currentStreak: { type: "W" | "L" | "D" | null; count: number };
  takenMostFrom: MoneyRival | null;
  lostMostTo: MoneyRival | null;
  topRivalsTaken: MoneyRival[];
  topRivalsLost: MoneyRival[];
  bestGames: GameWinStat[];
  history: HistoryItem[];
};

function isWin(row: PlayerEventRow): boolean {
  return row.placement === 1 || row.outcome === "win";
}

function isDraw(row: PlayerEventRow): boolean {
  return row.outcome === "draw";
}

function isLoss(row: PlayerEventRow): boolean {
  if (isDraw(row)) return false;
  if (row.outcome === "loss") return true;
  if (row.placement != null && row.placement !== 1) return true;
  return false;
}

function outcomeLabel(row: PlayerEventRow, status: string): string {
  if (status !== "completed") return status;
  if (isWin(row)) return "Win";
  if (isDraw(row)) return "Draw";
  if (isLoss(row)) return "Loss";
  return "Settled";
}

function streakLetter(row: PlayerEventRow): "W" | "L" | "D" | null {
  if (isWin(row)) return "W";
  if (isDraw(row)) return "D";
  if (isLoss(row)) return "L";
  return null;
}

/**
 * Build player dashboard stats from events the viewer can access (RLS).
 * Money rivals are attributed proportionally from co-players' units_delta
 * (same idea as wallet settlement).
 */
export function buildPlayerDashboard(input: {
  playerId: string;
  myRows: PlayerEventRow[];
  allRows: PlayerEventRow[];
  events: PlayerEventMeta[];
  catalog: CatalogName[];
  names: Map<string, string>;
}): PlayerDashboard {
  const eventById = new Map(input.events.map((e) => [e.id, e]));
  const catalogById = new Map(input.catalog.map((c) => [c.id, c]));
  const rowsByEvent = new Map<string, PlayerEventRow[]>();
  for (const row of input.allRows) {
    const list = rowsByEvent.get(row.event_id) ?? [];
    list.push(row);
    rowsByEvent.set(row.event_id, list);
  }

  const completedMine = input.myRows
    .filter((r) => {
      const e = eventById.get(r.event_id);
      return e?.status === "completed" && r.invite_status === "accepted";
    })
    .sort((a, b) => {
      const ea = eventById.get(a.event_id)!;
      const eb = eventById.get(b.event_id)!;
      const ta = +new Date(ea.played_at ?? ea.updated_at ?? ea.created_at);
      const tb = +new Date(eb.played_at ?? eb.updated_at ?? eb.created_at);
      return tb - ta;
    });

  let wins = 0;
  let losses = 0;
  let draws = 0;
  let moneyWon = 0;
  let moneyLost = 0;
  let biggestWin = 0;
  let biggestLoss = 0;

  const takenFrom = new Map<string, number>();
  const lostTo = new Map<string, number>();
  const gameStats = new Map<
    string,
    { wins: number; played: number; losses: number }
  >();

  for (const row of completedMine) {
    const delta = Number(row.units_delta ?? 0);
    const event = eventById.get(row.event_id)!;
    const catalogId = event.catalog_id;

    if (isWin(row)) wins += 1;
    else if (isDraw(row)) draws += 1;
    else if (isLoss(row)) losses += 1;

    if (delta > 0) {
      moneyWon += delta;
      biggestWin = Math.max(biggestWin, delta);
    } else if (delta < 0) {
      moneyLost += Math.abs(delta);
      biggestLoss = Math.max(biggestLoss, Math.abs(delta));
    }

    const gs = gameStats.get(catalogId) ?? {
      wins: 0,
      played: 0,
      losses: 0,
    };
    gs.played += 1;
    if (isWin(row)) gs.wins += 1;
    if (isLoss(row)) gs.losses += 1;
    gameStats.set(catalogId, gs);

    const peers = (rowsByEvent.get(row.event_id) ?? []).filter(
      (p) => p.user_id !== input.playerId && p.invite_status === "accepted"
    );

    if (delta > 0) {
      const losers = peers.filter((p) => Number(p.units_delta) < 0);
      const totalLost = losers.reduce(
        (s, p) => s + Math.abs(Number(p.units_delta)),
        0
      );
      if (totalLost > 0) {
        for (const loser of losers) {
          const share =
            (delta * Math.abs(Number(loser.units_delta))) / totalLost;
          takenFrom.set(
            loser.user_id,
            (takenFrom.get(loser.user_id) ?? 0) + share
          );
        }
      } else if (peers.length > 0) {
        const each = delta / peers.length;
        for (const peer of peers) {
          takenFrom.set(peer.user_id, (takenFrom.get(peer.user_id) ?? 0) + each);
        }
      }
    } else if (delta < 0) {
      const winners = peers.filter((p) => Number(p.units_delta) > 0);
      const totalWon = winners.reduce(
        (s, p) => s + Number(p.units_delta),
        0
      );
      const lost = Math.abs(delta);
      if (totalWon > 0) {
        for (const winner of winners) {
          const share = (lost * Number(winner.units_delta)) / totalWon;
          lostTo.set(
            winner.user_id,
            (lostTo.get(winner.user_id) ?? 0) + share
          );
        }
      } else if (peers.length > 0) {
        const each = lost / peers.length;
        for (const peer of peers) {
          lostTo.set(peer.user_id, (lostTo.get(peer.user_id) ?? 0) + each);
        }
      }
    }
  }

  function toRivals(map: Map<string, number>): MoneyRival[] {
    return [...map.entries()]
      .map(([userId, amount]) => ({
        userId,
        displayName: input.names.get(userId) ?? "Player",
        amount: Math.round(amount * 100) / 100,
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  const topRivalsTaken = toRivals(takenFrom).slice(0, 5);
  const topRivalsLost = toRivals(lostTo).slice(0, 5);

  const bestGames = [...gameStats.entries()]
    .map(([catalogId, s]) => ({
      catalogId,
      name: catalogById.get(catalogId)?.name ?? "Game",
      wins: s.wins,
      played: s.played,
      losses: s.losses,
    }))
    .sort((a, b) => b.wins - a.wins || b.played - a.played)
    .slice(0, 6);

  let streakType: "W" | "L" | "D" | null = null;
  let streakCount = 0;
  for (const row of completedMine) {
    const letter = streakLetter(row);
    if (!letter) continue;
    if (streakType === null) {
      streakType = letter;
      streakCount = 1;
      continue;
    }
    if (letter === streakType) streakCount += 1;
    else break;
  }

  const history: HistoryItem[] = input.myRows
    .map((row) => {
      const event = eventById.get(row.event_id);
      if (!event) return null;
      const catalog = catalogById.get(event.catalog_id);
      return {
        eventId: event.id,
        title: event.title,
        kind: event.kind,
        kindLabel: eventKindLabel(event.kind),
        status: event.status,
        catalogName: catalog?.name ?? "—",
        outcomeLabel: outcomeLabel(row, event.status),
        unitsDelta: Number(row.units_delta ?? 0),
        when: event.played_at ?? event.updated_at ?? event.created_at,
      } satisfies HistoryItem;
    })
    .filter((x): x is HistoryItem => x != null)
    .sort((a, b) => +new Date(b.when) - +new Date(a.when));

  const played = wins + losses + draws;
  const netMoney = moneyWon - moneyLost;

  return {
    played,
    wins,
    losses,
    draws,
    moneyWon,
    moneyLost,
    netMoney,
    winRate: played > 0 ? wins / played : null,
    biggestWin,
    biggestLoss,
    currentStreak: { type: streakType, count: streakCount },
    takenMostFrom: topRivalsTaken[0] ?? null,
    lostMostTo: topRivalsLost[0] ?? null,
    topRivalsTaken,
    topRivalsLost,
    bestGames,
    history,
  };
}

export function formatWinRate(rate: number | null): string {
  if (rate == null) return "—";
  return `${Math.round(rate * 100)}%`;
}

export function moneyLabel(amount: number): string {
  return `$${formatMoney(amount)}`;
}
