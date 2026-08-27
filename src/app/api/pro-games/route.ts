import { NextResponse } from "next/server";

import { fetchProGames, PRO_SPORTS, type ProSport } from "@/lib/pro-games";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sport = (searchParams.get("sport") ?? "mlb") as ProSport;
  if (!PRO_SPORTS.some((s) => s.id === sport)) {
    return NextResponse.json({ error: "Unknown sport." }, { status: 400 });
  }

  try {
    const games = await fetchProGames(sport);
    return NextResponse.json({
      sport,
      source: "espn",
      linesNote:
        "Spreads / totals / moneylines are DraftKings reference lines from ESPN when available. Friend bets still settle between you — not a sportsbook.",
      games,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load games." },
      { status: 502 }
    );
  }
}
