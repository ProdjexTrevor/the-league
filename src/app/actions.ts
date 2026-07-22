"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { profit, type ScoringMode } from "@/lib/wager";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

function fail(message: string): never {
  throw new Error(message);
}

async function ensureProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) fail("Not signed in.");

  await supabase.from("profiles").upsert(
    {
      id: user.id,
      display_name:
        (user.user_metadata?.display_name as string | undefined) ||
        user.email?.split("@")[0] ||
        "Player",
    },
    { onConflict: "id" }
  );

  return { supabase, user };
}

export async function createLeague(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const entryFee = Number(formData.get("entry_fee") ?? 0);

  if (!name) fail("League name is required.");

  const { supabase } = await ensureProfile();

  const { data, error } = await supabase.rpc("create_league", {
    p_name: name,
    p_description: description || null,
    p_entry_fee: Number.isFinite(entryFee) ? entryFee : 0,
  });

  if (error || !data) fail(error?.message ?? "Could not create league.");

  revalidatePath("/app");
  redirect(`/leagues/${data.id}`);
}

export async function joinLeague(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) fail("Invite code is required.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_league_by_code", {
    p_code: code,
  });

  if (error || !data) fail(error?.message ?? "Could not join league.");

  revalidatePath("/app");
  redirect(`/leagues/${data.id}`);
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${base || "game"}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createCustomGame(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const scoringMode = String(formData.get("scoring_mode") ?? "custom");

  const allowed: ScoringMode[] = [
    "higher_wins",
    "lower_wins",
    "placement",
    "head_to_head",
    "custom",
  ];
  if (!name) fail("Game name is required.");
  if (!allowed.includes(scoringMode as ScoringMode)) {
    fail("Invalid scoring mode.");
  }

  const { supabase, user } = await ensureProfile();

  const { data, error } = await supabase
    .from("game_catalog")
    .insert({
      slug: slugify(name),
      name,
      description: description || null,
      scoring_mode: scoringMode,
      scoring_config: {},
      is_active: true,
      is_system: false,
      created_by: user.id,
      sort_order: 500,
    })
    .select("id")
    .single();

  if (error || !data) fail(error?.message ?? "Could not create game.");

  revalidatePath("/catalog");
  revalidatePath("/create");
  redirect("/catalog");
}

export async function createEvent(formData: FormData) {
  const kind = String(formData.get("kind") ?? "game");
  const title = String(formData.get("title") ?? "").trim();
  const catalogId = String(formData.get("catalog_id") ?? "");
  const leagueIdRaw = String(formData.get("league_id") ?? "").trim();
  const leagueId = leagueIdRaw || null;
  const entryFee = Number(formData.get("entry_fee") ?? 0);
  const wagerMode = String(formData.get("wager_mode") ?? "pot");
  const stake = Number(formData.get("stake") ?? 0);
  const notes = String(formData.get("notes") ?? "").trim();
  const format = String(formData.get("format") ?? "").trim() || null;
  const bracketSizeRaw = String(formData.get("bracket_size") ?? "").trim();
  const bracketSize = bracketSizeRaw ? Number(bracketSizeRaw) : null;

  if (!title || !catalogId) fail("Title and game are required.");
  if (kind !== "game" && kind !== "tournament") fail("Invalid event kind.");

  const playerIds = [
    ...new Set(
      formData
        .getAll("player_id")
        .map((v) => String(v))
        .filter(Boolean)
    ),
  ];
  if (playerIds.length < 2) {
    fail("Select at least two players from the user list to start.");
  }

  const { supabase, user } = await ensureProfile();
  if (!playerIds.includes(user.id)) {
    playerIds.push(user.id);
  }

  const { data, error } = await supabase.rpc("create_event", {
    p_kind: kind,
    p_title: title,
    p_catalog_id: catalogId,
    p_league_id: leagueId,
    p_entry_fee: Number.isFinite(entryFee) ? entryFee : 0,
    p_wager_mode: wagerMode,
    p_stake: Number.isFinite(stake) ? stake : 0,
    p_notes: notes || null,
    p_format: kind === "tournament" ? format || "single_elim" : null,
    p_bracket_size:
      kind === "tournament" && bracketSize && Number.isFinite(bracketSize)
        ? bracketSize
        : null,
  });

  if (error || !data) fail(error?.message ?? "Could not create event.");

  // Creator is already inserted by create_event RPC; add the rest
  const entry = Number(data.entry_fee_units) || 0;
  for (const playerId of playerIds) {
    if (playerId === data.created_by) continue;
    const { error: playerError } = await supabase.from("event_players").insert({
      event_id: data.id,
      user_id: playerId,
      entry_paid: entry > 0,
      units_paid: entry,
    });
    if (playerError) fail(playerError.message);
  }

  // Optional initial odds lines
  if (wagerMode === "odds") {
    const stakeDefault = Number.isFinite(stake) ? stake : 0;
    for (const [key, value] of formData.entries()) {
      if (typeof value !== "string") continue;
      const playerMatch = key.match(/^odds_player_([a-zA-Z0-9_-]+)_num$/);
      if (playerMatch) {
        const playerId = playerMatch[1];
        const den = Number(formData.get(`odds_player_${playerId}_den`) ?? 1);
        const num = Number(value);
        if (num > 0 && den > 0) {
          await supabase.from("wager_lines").insert({
            event_id: data.id,
            player_id: playerId,
            odds_num: num,
            odds_den: den,
            stake_units: stakeDefault,
          });
        }
      }
    }
  }

  revalidatePath("/app");
  if (leagueId) revalidatePath(`/leagues/${leagueId}`);
  redirect(`/events/${data.id}`);
}

export async function addPlayerToEvent(eventId: string, formData: FormData) {
  const userId = String(formData.get("user_id") ?? "");
  const sideLabel = String(formData.get("side_label") ?? "").trim();
  if (!userId) fail("Pick a player.");

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("entry_fee_units, league_id")
    .eq("id", eventId)
    .single();

  if (!event) fail("Event not found.");

  const { error } = await supabase.from("event_players").insert({
    event_id: eventId,
    user_id: userId,
    side_label: sideLabel || null,
    entry_paid: Number(event.entry_fee_units) > 0,
    units_paid: Number(event.entry_fee_units) || 0,
  });

  if (error) fail(error.message);

  revalidatePath(`/events/${eventId}`);
  if (event.league_id) revalidatePath(`/leagues/${event.league_id}`);
}

export async function setWagerLine(eventId: string, formData: FormData) {
  const playerId = String(formData.get("player_id") ?? "").trim() || null;
  const sideLabel = String(formData.get("side_label") ?? "").trim() || null;
  const oddsNum = Number(formData.get("odds_num") ?? 0);
  const oddsDen = Number(formData.get("odds_den") ?? 1);
  const stake = Number(formData.get("stake_units") ?? 0);

  if (!playerId && !sideLabel) fail("Pick a player or side.");
  if (!(oddsNum > 0) || !(oddsDen > 0)) fail("Odds must be like 2 / 1.");

  const supabase = await createClient();
  const { error } = await supabase.from("wager_lines").insert({
    event_id: eventId,
    player_id: playerId,
    side_label: sideLabel,
    odds_num: oddsNum,
    odds_den: oddsDen,
    stake_units: Number.isFinite(stake) ? stake : 0,
  });

  if (error) fail(error.message);
  revalidatePath(`/events/${eventId}`);
}

export async function deleteWagerLine(eventId: string, formData: FormData) {
  const lineId = String(formData.get("line_id") ?? "");
  if (!lineId) fail("Missing line.");

  const supabase = await createClient();
  const { error } = await supabase.from("wager_lines").delete().eq("id", lineId);
  if (error) fail(error.message);
  revalidatePath(`/events/${eventId}`);
}

export async function settleEvent(eventId: string, formData: FormData) {
  const { supabase, user } = await ensureProfile();

  const { data: event } = await supabase
    .from("events")
    .select(
      "id, league_id, wager_mode, default_stake_units, entry_fee_units, status, catalog_id"
    )
    .eq("id", eventId)
    .single();

  if (!event) fail("Event not found.");
  if (event.status === "completed") fail("Already settled.");

  const { data: catalog } = await supabase
    .from("game_catalog")
    .select("scoring_mode")
    .eq("id", event.catalog_id)
    .single();

  const scoringMode = (catalog?.scoring_mode ?? "placement") as ScoringMode;

  const { data: players } = await supabase
    .from("event_players")
    .select("user_id")
    .eq("event_id", eventId);

  if (!players?.length) fail("Add players before settling.");

  type ResultRow = {
    user_id: string;
    score: number | null;
    placement: number | null;
    outcome: string | null;
  };

  const results: ResultRow[] = players.map((p) => ({
    user_id: p.user_id,
    score: formData.get(`score_${p.user_id}`)
      ? Number(formData.get(`score_${p.user_id}`))
      : null,
    placement: formData.get(`placement_${p.user_id}`)
      ? Number(formData.get(`placement_${p.user_id}`))
      : null,
    outcome: String(formData.get(`outcome_${p.user_id}`) ?? "").trim() || null,
  }));

  let winnerIds: string[] = [];

  if (scoringMode === "placement" || scoringMode === "custom") {
    if (results.some((r) => !r.placement || r.placement < 1)) {
      fail("Every player needs a placement (1 = winner).");
    }
    winnerIds = results.filter((r) => r.placement === 1).map((r) => r.user_id);
  } else if (scoringMode === "higher_wins" || scoringMode === "lower_wins") {
    if (results.some((r) => r.score === null || Number.isNaN(r.score))) {
      fail("Every player needs a score.");
    }
    const sorted = [...results].sort((a, b) =>
      scoringMode === "higher_wins"
        ? (b.score ?? 0) - (a.score ?? 0)
        : (a.score ?? 0) - (b.score ?? 0)
    );
    const best = sorted[0].score;
    winnerIds = sorted.filter((r) => r.score === best).map((r) => r.user_id);
    results.forEach((r, i) => {
      const rank =
        sorted.findIndex((s) => s.user_id === r.user_id) + 1;
      r.placement = rank;
    });
  } else if (scoringMode === "head_to_head") {
    if (results.some((r) => !r.outcome)) {
      fail("Every player needs win/loss/draw.");
    }
    winnerIds = results.filter((r) => r.outcome === "win").map((r) => r.user_id);
  }

  if (winnerIds.length === 0) fail("Could not determine a winner.");

  const deltas = new Map<string, number>();
  players.forEach((p) => deltas.set(p.user_id, 0));

  const wagerMode = event.wager_mode;
  const stake = Number(event.default_stake_units) || 0;
  const entryFee = Number(event.entry_fee_units) || 0;

  // Entry fees: each player paid entry; winners split the entry pot (optional accounting)
  if (entryFee > 0) {
    const entryPot = entryFee * players.length;
    const share = entryPot / winnerIds.length;
    for (const p of players) {
      const paid = -entryFee;
      const won = winnerIds.includes(p.user_id) ? share : 0;
      deltas.set(p.user_id, (deltas.get(p.user_id) ?? 0) + paid + won);
    }
  }

  if (wagerMode === "pot" && stake > 0) {
    const pot = stake * players.length;
    const share = pot / winnerIds.length;
    for (const p of players) {
      const paid = -stake;
      const won = winnerIds.includes(p.user_id) ? share : 0;
      deltas.set(p.user_id, (deltas.get(p.user_id) ?? 0) + paid + won);
    }
  }

  if (wagerMode === "odds") {
    const { data: lines } = await supabase
      .from("wager_lines")
      .select("*")
      .eq("event_id", eventId);

    for (const line of lines ?? []) {
      const lineStake = Number(line.stake_units) || stake;
      if (!lineStake || !line.player_id) continue;

      const backed = line.player_id;
      if (winnerIds.includes(backed)) {
        const winProfit = profit(lineStake, line.odds_num, line.odds_den);
        const funders = players.filter((p) => p.user_id !== backed);
        if (funders.length === 0) continue;
        const eachPays = winProfit / funders.length;
        for (const f of funders) {
          deltas.set(f.user_id, (deltas.get(f.user_id) ?? 0) - eachPays);
        }
        deltas.set(backed, (deltas.get(backed) ?? 0) + winProfit);
      } else {
        deltas.set(backed, (deltas.get(backed) ?? 0) - lineStake);
        const each = lineStake / winnerIds.length;
        for (const w of winnerIds) {
          deltas.set(w, (deltas.get(w) ?? 0) + each);
        }
      }
    }
  }

  for (const r of results) {
    const { error } = await supabase
      .from("event_players")
      .update({
        score: r.score,
        placement: r.placement,
        outcome: r.outcome,
        units_delta: deltas.get(r.user_id) ?? 0,
      })
      .eq("event_id", eventId)
      .eq("user_id", r.user_id);
    if (error) fail(error.message);
  }

  const { error: eventError } = await supabase
    .from("events")
    .update({
      status: "completed",
      played_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  if (eventError) fail(eventError.message);

  void user;
  revalidatePath(`/events/${eventId}`);
  if (event.league_id) revalidatePath(`/leagues/${event.league_id}`);
  revalidatePath("/app");
}

// --- Legacy game helpers (old routes) ------------------------------------------

export async function createGame(leagueId: string, formData: FormData) {
  formData.set("kind", "game");
  formData.set("league_id", leagueId);
  // Map old field names
  if (!formData.get("catalog_id") && formData.get("game_type_id")) {
    // cannot map uuid from old game_types; fail clearly
    fail("Use the new Game form with a catalog game.");
  }
  if (!formData.get("stake") && formData.get("wager_units")) {
    formData.set("stake", String(formData.get("wager_units")));
  }
  await createEvent(formData);
}

export async function completeGame(
  leagueId: string,
  gameId: string,
  formData: FormData
) {
  void leagueId;
  await settleEvent(gameId, formData);
}

export async function addPlayerToGame(
  leagueId: string,
  gameId: string,
  formData: FormData
) {
  void leagueId;
  await addPlayerToEvent(gameId, formData);
}
