export type ProSport =
  | "nfl"
  | "nba"
  | "mlb"
  | "nhl"
  | "ncaaf"
  | "ncaab";

export const PRO_SPORTS: {
  id: ProSport;
  label: string;
  path: string;
}[] = [
  { id: "nfl", label: "NFL", path: "football/nfl" },
  { id: "nba", label: "NBA", path: "basketball/nba" },
  { id: "mlb", label: "MLB", path: "baseball/mlb" },
  { id: "nhl", label: "NHL", path: "hockey/nhl" },
  { id: "ncaaf", label: "NCAAF", path: "football/college-football" },
  { id: "ncaab", label: "NCAAB", path: "basketball/mens-college-basketball" },
];

export type ProMarket = {
  id: string;
  kind: "moneyline" | "spread" | "total";
  label: string;
  title: string;
  line: string;
};

export type ProGame = {
  id: string;
  sport: ProSport;
  sportLabel: string;
  name: string;
  shortName: string;
  start: string | null;
  status: string;
  away: string;
  home: string;
  awayAbbr: string;
  homeAbbr: string;
  hasLines: boolean;
  markets: ProMarket[];
};

type EspnCompetitor = {
  homeAway?: string;
  team?: {
    displayName?: string;
    abbreviation?: string;
    shortDisplayName?: string;
  };
};

type EspnOdds = {
  overUnder?: number;
  spread?: number;
  details?: string;
  moneyline?: {
    home?: { close?: { odds?: string } };
    away?: { close?: { odds?: string } };
  };
  pointSpread?: {
    home?: { close?: { line?: string; odds?: string } };
    away?: { close?: { line?: string; odds?: string } };
  };
  total?: {
    over?: { close?: { line?: string; odds?: string } };
    under?: { close?: { line?: string; odds?: string } };
  };
};

function fmtTime(iso: string | undefined) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function buildMarkets(
  sportLabel: string,
  away: string,
  home: string,
  awayAbbr: string,
  homeAbbr: string,
  odds: EspnOdds | undefined
): ProMarket[] {
  if (!odds) return [];

  const markets: ProMarket[] = [];
  const awayMl = odds.moneyline?.away?.close?.odds;
  const homeMl = odds.moneyline?.home?.close?.odds;
  if (awayMl) {
    markets.push({
      id: "ml-away",
      kind: "moneyline",
      label: `${awayAbbr} ML ${awayMl}`,
      title: `${away} moneyline vs ${home}`,
      line: `${sportLabel}: ${away} ML ${awayMl} (ref DraftKings)`,
    });
  }
  if (homeMl) {
    markets.push({
      id: "ml-home",
      kind: "moneyline",
      label: `${homeAbbr} ML ${homeMl}`,
      title: `${home} moneyline vs ${away}`,
      line: `${sportLabel}: ${home} ML ${homeMl} (ref DraftKings)`,
    });
  }

  const awaySpread = odds.pointSpread?.away?.close;
  const homeSpread = odds.pointSpread?.home?.close;
  if (awaySpread?.line) {
    markets.push({
      id: "spread-away",
      kind: "spread",
      label: `${awayAbbr} ${awaySpread.line}${awaySpread.odds ? ` (${awaySpread.odds})` : ""}`,
      title: `${away} ${awaySpread.line} vs ${home}`,
      line: `${sportLabel} spread: ${away} ${awaySpread.line}${awaySpread.odds ? ` ${awaySpread.odds}` : ""} (ref DraftKings)`,
    });
  }
  if (homeSpread?.line) {
    markets.push({
      id: "spread-home",
      kind: "spread",
      label: `${homeAbbr} ${homeSpread.line}${homeSpread.odds ? ` (${homeSpread.odds})` : ""}`,
      title: `${home} ${homeSpread.line} vs ${away}`,
      line: `${sportLabel} spread: ${home} ${homeSpread.line}${homeSpread.odds ? ` ${homeSpread.odds}` : ""} (ref DraftKings)`,
    });
  }

  const over = odds.total?.over?.close;
  const under = odds.total?.under?.close;
  const ou =
    odds.overUnder != null
      ? String(odds.overUnder)
      : over?.line?.replace(/^[ou]/i, "") ?? null;
  if (ou) {
    markets.push({
      id: "total-over",
      kind: "total",
      label: `Over ${ou}${over?.odds ? ` (${over.odds})` : ""}`,
      title: `${awayAbbr} @ ${homeAbbr} over ${ou}`,
      line: `${sportLabel} total: Over ${ou}${over?.odds ? ` ${over.odds}` : ""} (ref DraftKings)`,
    });
    markets.push({
      id: "total-under",
      kind: "total",
      label: `Under ${ou}${under?.odds ? ` (${under.odds})` : ""}`,
      title: `${awayAbbr} @ ${homeAbbr} under ${ou}`,
      line: `${sportLabel} total: Under ${ou}${under?.odds ? ` ${under.odds}` : ""} (ref DraftKings)`,
    });
  }

  return markets;
}

export async function fetchProGames(sport: ProSport): Promise<ProGame[]> {
  const meta = PRO_SPORTS.find((s) => s.id === sport);
  if (!meta) return [];

  const url = `https://site.api.espn.com/apis/site/v2/sports/${meta.path}/scoreboard`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; TheLeague/1.0; +https://the-league-ivory.vercel.app)",
      Accept: "application/json",
    },
    next: { revalidate: 120 },
  });

  if (!res.ok) {
    throw new Error(`Could not load ${meta.label} slate (${res.status}).`);
  }

  const data = (await res.json()) as {
    events?: Array<{
      id?: string;
      name?: string;
      shortName?: string;
      date?: string;
      status?: { type?: { shortDetail?: string; description?: string } };
      competitions?: Array<{
        competitors?: EspnCompetitor[];
        odds?: EspnOdds[];
        date?: string;
      }>;
    }>;
  };

  const games: ProGame[] = [];
  for (const event of data.events ?? []) {
    const comp = event.competitions?.[0];
    const competitors = comp?.competitors ?? [];
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");
    const homeName = home?.team?.displayName ?? "Home";
    const awayName = away?.team?.displayName ?? "Away";
    const homeAbbr =
      home?.team?.abbreviation ?? home?.team?.shortDisplayName ?? "HOME";
    const awayAbbr =
      away?.team?.abbreviation ?? away?.team?.shortDisplayName ?? "AWAY";
    const odds = comp?.odds?.[0];
    const markets = buildMarkets(
      meta.label,
      awayName,
      homeName,
      awayAbbr,
      homeAbbr,
      odds
    );

    games.push({
      id: String(event.id ?? `${sport}-${awayAbbr}-${homeAbbr}`),
      sport,
      sportLabel: meta.label,
      name: event.name ?? `${awayName} at ${homeName}`,
      shortName: event.shortName ?? `${awayAbbr} @ ${homeAbbr}`,
      start: fmtTime(comp?.date ?? event.date),
      status:
        event.status?.type?.shortDetail ??
        event.status?.type?.description ??
        "Scheduled",
      away: awayName,
      home: homeName,
      awayAbbr,
      homeAbbr,
      hasLines: markets.length > 0,
      markets,
    });
  }

  return games;
}
