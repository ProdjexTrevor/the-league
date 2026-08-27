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

  const venmo = user.user_metadata?.venmo_username
    ? String(user.user_metadata.venmo_username)
        .trim()
        .replace(/^@+/, "")
        .toLowerCase()
    : null;

  await supabase.from("profiles").upsert(
    {
      id: user.id,
      display_name:
        (user.user_metadata?.display_name as string | undefined) ||
        user.email?.split("@")[0] ||
        "Player",
      ...(venmo ? { venmo_username: venmo } : {}),
    },
    { onConflict: "id" }
  );

  return { supabase, user };
}

export async function updateVenmoUsername(formData: FormData) {
  const raw = String(formData.get("venmo_username") ?? "").trim();
  const venmo = raw.replace(/^@+/, "").toLowerCase();
  if (!venmo) fail("Venmo username is required.");
  if (!/^[a-z0-9_-]{3,30}$/i.test(venmo)) {
    fail("Enter a valid Venmo username (letters, numbers, _ or -).");
  }

  const { supabase, user } = await ensureProfile();
  const { error } = await supabase
    .from("profiles")
    .update({ venmo_username: venmo })
    .eq("id", user.id);
  if (error) fail(error.message);

  await supabase.auth.updateUser({ data: { venmo_username: venmo } });

  revalidatePath("/wallet");
  revalidatePath("/app");
}

export async function markObligationPaid(formData: FormData) {
  const id = String(formData.get("obligation_id") ?? "");
  if (!id) fail("Missing obligation.");

  const { supabase, user } = await ensureProfile();
  const { error } = await supabase
    .from("wallet_obligations")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", id)
    .eq("from_user_id", user.id);
  if (error) fail(error.message);

  revalidatePath("/wallet");
}

export async function markCounterpartyPaid(formData: FormData) {
  const counterpartyId = String(formData.get("counterparty_id") ?? "");
  if (!counterpartyId) fail("Missing player.");

  const { supabase, user } = await ensureProfile();
  const { error } = await supabase
    .from("wallet_obligations")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("from_user_id", user.id)
    .eq("to_user_id", counterpartyId)
    .eq("status", "open");
  if (error) fail(error.message);

  revalidatePath("/wallet");
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

/** Phone bet: straight-up or odds; person vs person or team vs team. */
export async function quickBet(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const catalogId = String(formData.get("catalog_id") ?? "").trim();
  const wagerType = String(formData.get("wager_type") ?? "straight"); // straight | odds
  const matchup = String(formData.get("matchup") ?? "person"); // person | team
  const line = String(formData.get("line") ?? "").trim();
  const terms = String(formData.get("terms") ?? "").trim();

  if (!title) fail("What’s the bet?");
  if (!catalogId) fail("Missing game catalog.");

  const { user } = await ensureProfile();
  const fd = new FormData();
  fd.set("kind", "bet");
  fd.set("title", title);
  fd.set("catalog_id", catalogId);
  fd.set("wager_mode", "custom");
  fd.set("entry_fee", "0");

  const notes = [
    wagerType === "odds" ? "Odds bet (different stakes)" : "Straight up",
    matchup === "team" ? "Team vs team" : "Person vs person",
    line ? `Line: ${line}` : null,
    terms || null,
  ]
    .filter(Boolean)
    .join("\n");
  fd.set("notes", notes || title);

  const tripId = String(formData.get("trip_id") ?? "").trim();
  if (tripId) fd.set("trip_id", tripId);

  if (matchup === "person") {
    const againstId = String(formData.get("against_id") ?? "").trim();
    const myStake = Number(formData.get("my_stake") ?? 0);
    const theirStakeRaw = Number(formData.get("their_stake") ?? 0);
    const theirStake = wagerType === "straight" ? myStake : theirStakeRaw;

    if (!againstId) fail("Pick who you’re betting against.");
    if (!(myStake > 0)) fail("Enter your stake.");
    if (!(theirStake > 0)) fail("Enter their stake.");
    if (againstId === user.id) fail("Pick someone else.");

    fd.set("wager_scope", "player");
    fd.set("stake", String(myStake));
    fd.append("player_id", againstId);
    fd.append("player_id", user.id);
    fd.set(`wager_player_${user.id}`, String(myStake));
    fd.set(`wager_player_${againstId}`, String(theirStake));
  } else {
    const teamA = String(formData.get("team_a_name") ?? "Team A").trim() || "Team A";
    const teamB = String(formData.get("team_b_name") ?? "Team B").trim() || "Team B";
    const stakeA = Number(formData.get("stake_a") ?? 0);
    const stakeBRaw = Number(formData.get("stake_b") ?? 0);
    const stakeB = wagerType === "straight" ? stakeA : stakeBRaw;
    const teamAPlayers = formData
      .getAll("team_a_player")
      .map((v) => String(v))
      .filter(Boolean);
    const teamBPlayers = formData
      .getAll("team_b_player")
      .map((v) => String(v))
      .filter(Boolean);

    if (!teamAPlayers.includes(user.id) && !teamBPlayers.includes(user.id)) {
      // put creator on team A if they forgot
      teamAPlayers.push(user.id);
    }
    if (teamAPlayers.length < 1 || teamBPlayers.length < 1) {
      fail("Each team needs at least one player.");
    }
    const overlap = teamAPlayers.filter((id) => teamBPlayers.includes(id));
    if (overlap.length > 0) fail("A player can’t be on both teams.");
    if (!(stakeA > 0)) fail("Enter Team A’s stake.");
    if (!(stakeB > 0)) fail("Enter Team B’s stake.");

    fd.set("wager_scope", "team");
    fd.set("team_1_name", teamA);
    fd.set("team_2_name", teamB);
    fd.set("wager_team_1", String(stakeA));
    fd.set("wager_team_2", String(stakeB));
    fd.set("stake", String(Math.max(stakeA, stakeB)));

    for (const id of [...new Set([...teamAPlayers, ...teamBPlayers])]) {
      fd.append("player_id", id);
      if (teamAPlayers.includes(id)) fd.set(`player_team_${id}`, "1");
      if (teamBPlayers.includes(id)) fd.set(`player_team_${id}`, "2");
    }
  }

  await createEvent(fd);
}

/**
 * Each accepted player claims who won. When everyone agrees, settle + wallet IOUs.
 */
export async function claimBetResult(eventId: string, formData: FormData) {
  const winnerKey = String(formData.get("winner_key") ?? "").trim();
  if (!winnerKey) fail("Pick who won.");

  const { supabase, user } = await ensureProfile();

  const { data: event } = await supabase
    .from("events")
    .select("id, league_id, kind, wager_mode, status, catalog_id, default_stake_units, entry_fee_units")
    .eq("id", eventId)
    .single();
  if (!event) fail("Event not found.");
  if (event.kind !== "bet") fail("Result claims are for bets.");
  if (event.status === "completed") fail("Already settled.");

  const { data: allPlayers } = await supabase
    .from("event_players")
    .select("user_id, side_label, invite_status")
    .eq("event_id", eventId);

  const me = (allPlayers ?? []).find((p) => p.user_id === user.id);
  if (!me || (me.invite_status ?? "accepted") !== "accepted") {
    fail("Accept the invite before claiming a result.");
  }

  const pending = (allPlayers ?? []).filter((p) => p.invite_status === "pending");
  if (pending.length > 0) {
    fail("Everyone must accept the invite before settling.");
  }

  const accepted = (allPlayers ?? []).filter(
    (p) => (p.invite_status ?? "accepted") === "accepted"
  );

  // Validate winner_key
  if (winnerKey.startsWith("user:")) {
    const wid = winnerKey.slice(5);
    if (!accepted.some((p) => p.user_id === wid)) fail("Invalid winner.");
  } else if (winnerKey.startsWith("side:")) {
    const side = winnerKey.slice(5);
    if (!accepted.some((p) => p.side_label === side)) fail("Invalid winning team.");
  } else {
    fail("Invalid winner.");
  }

  const { error: upsertError } = await supabase.from("bet_result_claims").upsert(
    {
      event_id: eventId,
      user_id: user.id,
      winner_key: winnerKey,
    },
    { onConflict: "event_id,user_id" }
  );
  if (upsertError) fail(upsertError.message);

  const { data: claims } = await supabase
    .from("bet_result_claims")
    .select("user_id, winner_key")
    .eq("event_id", eventId);

  const claimByUser = new Map((claims ?? []).map((c) => [c.user_id, c.winner_key]));
  const everyoneClaimed = accepted.every((p) => claimByUser.has(p.user_id));
  const keys = accepted.map((p) => claimByUser.get(p.user_id));
  const allAgree =
    everyoneClaimed && keys.every((k) => k && k === keys[0]);

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/app");

  if (!allAgree) {
    return;
  }

  // Build settle form outcomes and finalize
  const agreed = keys[0] as string;
  const settleFd = new FormData();

  if (agreed.startsWith("user:")) {
    const winnerId = agreed.slice(5);
    for (const p of accepted) {
      settleFd.set(
        `outcome_${p.user_id}`,
        p.user_id === winnerId ? "win" : "loss"
      );
    }
  } else {
    const side = agreed.slice(5);
    for (const p of accepted) {
      settleFd.set(
        `outcome_${p.user_id}`,
        p.side_label === side ? "win" : "loss"
      );
    }
  }

  await settleEvent(eventId, settleFd);
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
  if (kind !== "game" && kind !== "tournament" && kind !== "bet") {
    fail("Invalid event kind.");
  }
  if (kind === "bet" && !notes) {
    fail("Describe the bet so everyone knows what they are taking.");
  }

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

  // Creator is already inserted (accepted) by create_event RPC; invite the rest
  const entry = Number(data.entry_fee_units) || 0;
  const wagerScope = String(
    formData.get("wager_scope") ?? formData.get("odds_scope") ?? "player"
  );
  const team1Name =
    String(formData.get("team_1_name") ?? "Team 1").trim() || "Team 1";
  const team2Name =
    String(formData.get("team_2_name") ?? "Team 2").trim() || "Team 2";
  const usesTeamSides =
    (wagerMode === "custom" || wagerMode === "odds") && wagerScope === "team";

  function sideForPlayer(playerId: string): string | null {
    if (!usesTeamSides) return null;
    const slot = String(formData.get(`player_team_${playerId}`) ?? "").trim();
    if (slot === "1") return team1Name;
    if (slot === "2") return team2Name;
    return null;
  }

  for (const playerId of playerIds) {
    const sideLabel = sideForPlayer(playerId);
    if (playerId === data.created_by) {
      if (sideLabel) {
        const { error: sideError } = await supabase
          .from("event_players")
          .update({ side_label: sideLabel })
          .eq("event_id", data.id)
          .eq("user_id", playerId);
        if (sideError) fail(sideError.message);
      }
      continue;
    }
    const { error: playerError } = await supabase.from("event_players").insert({
      event_id: data.id,
      user_id: playerId,
      side_label: sideLabel,
      entry_paid: entry > 0,
      units_paid: entry,
      invite_status: "pending",
    });
    if (playerError) fail(playerError.message);
  }

  // Custom wagers: each player or team puts up an explicit money amount
  // For player-scope bets/games, only store the creator's stake at create time;
  // invitees enter theirs when they accept.
  if (wagerMode === "custom") {
    let linesCreated = 0;

    if (wagerScope === "team") {
      const unassigned = playerIds.filter((id) => !sideForPlayer(id));
      if (unassigned.length > 0) {
        fail("Assign every player to a team for custom team wagers.");
      }
      for (const [slot, label] of [
        ["1", team1Name],
        ["2", team2Name],
      ] as const) {
        const amount = Number(formData.get(`wager_team_${slot}`) ?? 0);
        if (amount > 0) {
          const { error: lineError } = await supabase.from("wager_lines").insert({
            event_id: data.id,
            side_label: label,
            odds_num: 1,
            odds_den: 1,
            stake_units: amount,
          });
          if (lineError) fail(lineError.message);
          linesCreated += 1;
        }
      }
    } else if (kind === "bet") {
      // Prefer explicit stakes for every player when provided (straight/odds quick bet).
      let linesCreatedForBet = 0;
      for (const playerId of playerIds) {
        const amount = Number(formData.get(`wager_player_${playerId}`) ?? 0);
        if (!(amount > 0)) continue;
        const { error: lineError } = await supabase.from("wager_lines").insert({
          event_id: data.id,
          player_id: playerId,
          odds_num: 1,
          odds_den: 1,
          stake_units: amount,
        });
        if (lineError) fail(lineError.message);
        linesCreatedForBet += 1;
      }
      if (linesCreatedForBet === 0) {
        const amount = Number(formData.get(`wager_player_${user.id}`) ?? 0);
        if (!(amount > 0)) {
          fail("Enter how much money you are wagering.");
        }
        const { error: lineError } = await supabase.from("wager_lines").insert({
          event_id: data.id,
          player_id: user.id,
          odds_num: 1,
          odds_den: 1,
          stake_units: amount,
        });
        if (lineError) fail(lineError.message);
        linesCreatedForBet = 1;
      }
      linesCreated = linesCreatedForBet;
    } else {
      for (const playerId of playerIds) {
        const amount = Number(formData.get(`wager_player_${playerId}`) ?? 0);
        if (amount > 0) {
          const { error: lineError } = await supabase.from("wager_lines").insert({
            event_id: data.id,
            player_id: playerId,
            odds_num: 1,
            odds_den: 1,
            stake_units: amount,
          });
          if (lineError) fail(lineError.message);
          linesCreated += 1;
        }
      }
    }

    if (linesCreated === 0) {
      fail("Enter how much money each player or team is wagering.");
    }
  }

  // Legacy odds lines (existing events / old clients)
  if (wagerMode === "odds") {
    const stakeDefault = Number.isFinite(stake) ? stake : 0;
    let linesCreated = 0;

    if (wagerScope === "team") {
      for (const [slot, label] of [
        ["1", team1Name],
        ["2", team2Name],
      ] as const) {
        const num = Number(formData.get(`odds_team_${slot}_num`) ?? 0);
        const den = Number(formData.get(`odds_team_${slot}_den`) ?? 1);
        if (num > 0 && den > 0) {
          const { error: lineError } = await supabase.from("wager_lines").insert({
            event_id: data.id,
            side_label: label,
            odds_num: num,
            odds_den: den,
            stake_units: stakeDefault,
          });
          if (lineError) fail(lineError.message);
          linesCreated += 1;
        }
      }
      const unassigned = playerIds.filter((id) => !sideForPlayer(id));
      if (unassigned.length > 0) {
        fail("Assign every player to a team when using team odds.");
      }
    } else {
      for (const playerId of playerIds) {
        const num = Number(formData.get(`odds_player_${playerId}_num`) ?? 0);
        const den = Number(formData.get(`odds_player_${playerId}_den`) ?? 1);
        if (num > 0 && den > 0) {
          const { error: lineError } = await supabase.from("wager_lines").insert({
            event_id: data.id,
            player_id: playerId,
            odds_num: num,
            odds_den: den,
            stake_units: stakeDefault,
          });
          if (lineError) fail(lineError.message);
          linesCreated += 1;
        }
      }
    }

    if (linesCreated === 0) {
      fail("Set odds for at least one player or team (e.g. 2 / 1).");
    }
  }

  const tripId = String(formData.get("trip_id") ?? "").trim();
  if (tripId) {
    const { data: membership } = await supabase
      .from("trip_members")
      .select("trip_id")
      .eq("trip_id", tripId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) fail("You’re not on that trip.");

    const { error: tripError } = await supabase
      .from("events")
      .update({ trip_id: tripId })
      .eq("id", data.id);
    if (tripError) fail(tripError.message);

    for (const playerId of playerIds) {
      await supabase.from("trip_members").upsert(
        { trip_id: tripId, user_id: playerId },
        { onConflict: "trip_id,user_id" }
      );
    }
    revalidatePath(`/trips/${tripId}`);
    revalidatePath("/trips");
  }

  revalidatePath("/app");
  if (leagueId) revalidatePath(`/leagues/${leagueId}`);
  redirect(`/events/${data.id}`);
}

export async function createTrip(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const startsOn = String(formData.get("starts_on") ?? "").trim() || null;
  const endsOn = String(formData.get("ends_on") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const memberIds = [
    ...new Set(
      formData
        .getAll("member_id")
        .map((v) => String(v))
        .filter(Boolean)
    ),
  ];

  if (!name) fail("Name the trip or weekend.");

  const { supabase, user } = await ensureProfile();
  const { data, error } = await supabase
    .from("trips")
    .insert({
      name,
      created_by: user.id,
      starts_on: startsOn,
      ends_on: endsOn,
      notes,
    })
    .select("id")
    .single();
  if (error || !data) fail(error?.message ?? "Could not create trip.");

  const members = [...new Set([user.id, ...memberIds])];
  const { error: memError } = await supabase.from("trip_members").insert(
    members.map((user_id) => ({ trip_id: data.id, user_id }))
  );
  if (memError) fail(memError.message);

  revalidatePath("/trips");
  redirect(`/trips/${data.id}`);
}

export async function addTripMembers(tripId: string, formData: FormData) {
  const memberIds = [
    ...new Set(
      formData
        .getAll("member_id")
        .map((v) => String(v))
        .filter(Boolean)
    ),
  ];
  if (memberIds.length === 0) fail("Pick at least one person.");

  const { supabase, user } = await ensureProfile();
  const { data: trip } = await supabase
    .from("trips")
    .select("id, created_by")
    .eq("id", tripId)
    .single();
  if (!trip) fail("Trip not found.");
  if (trip.created_by !== user.id) fail("Only the trip creator can add people.");

  const { error } = await supabase.from("trip_members").upsert(
    memberIds.map((user_id) => ({ trip_id: tripId, user_id })),
    { onConflict: "trip_id,user_id" }
  );
  if (error) fail(error.message);

  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/trips");
}

export async function closeTrip(tripId: string) {
  const { supabase, user } = await ensureProfile();
  const { data: trip } = await supabase
    .from("trips")
    .select("id, created_by")
    .eq("id", tripId)
    .single();
  if (!trip) fail("Trip not found.");
  if (trip.created_by !== user.id) fail("Only the trip creator can close it.");

  const { error } = await supabase
    .from("trips")
    .update({ status: "closed" })
    .eq("id", tripId);
  if (error) fail(error.message);

  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/trips");
}

export async function acceptEventInvite(eventId: string, formData: FormData) {
  const wagerRaw = String(formData.get("wager_units") ?? "").trim();
  const wagerUnits = wagerRaw === "" ? null : Number(wagerRaw);
  if (wagerRaw !== "" && !(Number.isFinite(wagerUnits) && (wagerUnits as number) > 0)) {
    fail("Enter how much money you are wagering.");
  }

  const { supabase, user } = await ensureProfile();
  const { data: event } = await supabase
    .from("events")
    .select("id, league_id, kind, wager_mode")
    .eq("id", eventId)
    .single();
  if (!event) fail("Event not found.");

  if (
    event.kind === "bet" &&
    event.wager_mode === "custom" &&
    (wagerUnits == null || !(wagerUnits > 0))
  ) {
    const { data: existingLine } = await supabase
      .from("wager_lines")
      .select("id")
      .eq("event_id", eventId)
      .eq("player_id", user.id)
      .limit(1);
    const { data: myPlayer } = await supabase
      .from("event_players")
      .select("side_label")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();
    let teamCovered = false;
    if (myPlayer?.side_label) {
      const { data: sideLine } = await supabase
        .from("wager_lines")
        .select("id")
        .eq("event_id", eventId)
        .eq("side_label", myPlayer.side_label)
        .limit(1);
      teamCovered = (sideLine?.length ?? 0) > 0;
    }
    if (!(existingLine?.length || teamCovered)) {
      fail("Enter how much money you are wagering to accept this bet.");
    }
  }

  const { error } = await supabase.rpc("accept_event_invite", {
    p_event_id: eventId,
    p_wager_units: wagerUnits,
  });
  if (error) fail(error.message);

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/app");
  if (event.league_id) revalidatePath(`/leagues/${event.league_id}`);
}

export async function declineEventInvite(eventId: string) {
  const { supabase } = await ensureProfile();
  const { data: event } = await supabase
    .from("events")
    .select("id, league_id")
    .eq("id", eventId)
    .single();
  if (!event) fail("Event not found.");

  const { error } = await supabase.rpc("decline_event_invite", {
    p_event_id: eventId,
  });
  if (error) fail(error.message);

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/app");
  if (event.league_id) revalidatePath(`/leagues/${event.league_id}`);
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
    invite_status: "pending",
  });

  if (error) fail(error.message);

  revalidatePath(`/events/${eventId}`);
  if (event.league_id) revalidatePath(`/leagues/${event.league_id}`);
}

export async function setWagerLine(eventId: string, formData: FormData) {
  const playerId = String(formData.get("player_id") ?? "").trim() || null;
  const sideLabel = String(formData.get("side_label") ?? "").trim() || null;
  const stake = Number(
    formData.get("stake_units") ?? formData.get("wager_amount") ?? 0
  );
  const oddsNumRaw = formData.get("odds_num");
  const oddsDenRaw = formData.get("odds_den");
  const hasOdds = oddsNumRaw != null && String(oddsNumRaw).trim() !== "";
  const oddsNum = hasOdds ? Number(oddsNumRaw) : 1;
  const oddsDen = hasOdds ? Number(oddsDenRaw ?? 1) : 1;

  if (!playerId && !sideLabel) fail("Pick a player or side.");
  if (!(stake > 0)) fail("Enter how much money is being wagered.");
  if (hasOdds && (!(oddsNum > 0) || !(oddsDen > 0))) {
    fail("Odds must be like 2 / 1.");
  }

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
  if (event.status === "completed") {
    // Repair path: completed event with money but never wrote wallet rows
    const { data: existing } = await supabase
      .from("wallet_obligations")
      .select("id")
      .eq("event_id", eventId)
      .limit(1);
    if (!existing?.length) {
      const { error: repairError } = await supabase.rpc(
        "record_event_obligations",
        { p_event_id: eventId }
      );
      if (repairError) fail(repairError.message);
      revalidatePath("/wallet");
      revalidatePath(`/events/${eventId}`);
      fail("Already settled. Missing wallet IOUs were created — check Wallet.");
    }
    fail("Already settled.");
  }

  const { data: catalog } = await supabase
    .from("game_catalog")
    .select("scoring_mode")
    .eq("id", event.catalog_id)
    .single();

  const scoringMode = (catalog?.scoring_mode ?? "placement") as ScoringMode;

  const { data: allPlayers } = await supabase
    .from("event_players")
    .select("user_id, side_label, invite_status")
    .eq("event_id", eventId);

  const players = (allPlayers ?? []).filter(
    (p) => (p.invite_status ?? "accepted") === "accepted"
  );

  if (!players.length) fail("Wait for players to accept before settling.");
  const pending = (allPlayers ?? []).filter(
    (p) => p.invite_status === "pending"
  );
  if (pending.length > 0) {
    fail("Everyone invited must accept (or decline) before settling.");
  }

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

  // Custom: each player/team puts up money; losers forfeit; winners split the pot
  if (wagerMode === "custom") {
    const { data: lines } = await supabase
      .from("wager_lines")
      .select("*")
      .eq("event_id", eventId);

    const stakeByPlayer = new Map<string, number>();
    players.forEach((p) => stakeByPlayer.set(p.user_id, 0));

    for (const line of lines ?? []) {
      const amount = Number(line.stake_units) || 0;
      if (!(amount > 0)) continue;

      if (line.player_id) {
        stakeByPlayer.set(
          line.player_id,
          (stakeByPlayer.get(line.player_id) ?? 0) + amount
        );
        continue;
      }

      if (!line.side_label) continue;
      const members = players.filter((p) => p.side_label === line.side_label);
      if (members.length === 0) continue;
      const each = amount / members.length;
      for (const m of members) {
        stakeByPlayer.set(m.user_id, (stakeByPlayer.get(m.user_id) ?? 0) + each);
      }
    }

    const winnerSet = new Set(winnerIds);
    let losersPot = 0;
    for (const p of players) {
      if (winnerSet.has(p.user_id)) continue;
      const s = stakeByPlayer.get(p.user_id) ?? 0;
      if (s > 0) {
        losersPot += s;
        deltas.set(p.user_id, (deltas.get(p.user_id) ?? 0) - s);
      }
    }
    if (losersPot > 0 && winnerIds.length > 0) {
      const share = losersPot / winnerIds.length;
      for (const w of winnerIds) {
        deltas.set(w, (deltas.get(w) ?? 0) + share);
      }
    }
  }

  if (wagerMode === "odds") {
    const { data: lines } = await supabase
      .from("wager_lines")
      .select("*")
      .eq("event_id", eventId);

    for (const line of lines ?? []) {
      const lineStake = Number(line.stake_units) || stake;
      if (!lineStake) continue;

      // Per-player line
      if (line.player_id) {
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
        continue;
      }

      // Per-team / side line
      if (!line.side_label) continue;
      const side = line.side_label;
      const backedPlayers = players.filter((p) => p.side_label === side);
      const opposingPlayers = players.filter((p) => p.side_label !== side);
      if (backedPlayers.length === 0 || opposingPlayers.length === 0) continue;

      const sideWon = backedPlayers.some((p) =>
        winnerIds.includes(p.user_id)
      );

      if (sideWon) {
        const winProfit = profit(lineStake, line.odds_num, line.odds_den);
        const eachPays = winProfit / opposingPlayers.length;
        const eachGets = winProfit / backedPlayers.length;
        for (const f of opposingPlayers) {
          deltas.set(f.user_id, (deltas.get(f.user_id) ?? 0) - eachPays);
        }
        for (const b of backedPlayers) {
          deltas.set(b.user_id, (deltas.get(b.user_id) ?? 0) + eachGets);
        }
      } else {
        const eachLoses = lineStake / backedPlayers.length;
        const winnersOnOpposing = opposingPlayers.filter((p) =>
          winnerIds.includes(p.user_id)
        );
        const receivers =
          winnersOnOpposing.length > 0 ? winnersOnOpposing : opposingPlayers;
        const eachGets = lineStake / receivers.length;
        for (const b of backedPlayers) {
          deltas.set(b.user_id, (deltas.get(b.user_id) ?? 0) - eachLoses);
        }
        for (const r of receivers) {
          deltas.set(r.user_id, (deltas.get(r.user_id) ?? 0) + eachGets);
        }
      }
    }
  }

  // Round to cents so wallet IOUs match stored money deltas
  for (const [uid, raw] of deltas) {
    deltas.set(uid, Math.round(raw * 100) / 100);
  }

  const moneyConfigured =
    entryFee > 0 ||
    (wagerMode === "pot" && stake > 0) ||
    wagerMode === "custom" ||
    wagerMode === "odds";
  const moneyMoved = [...deltas.values()].some((d) => d !== 0);
  if (moneyConfigured && !moneyMoved && (wagerMode === "custom" || wagerMode === "odds")) {
    fail(
      "No money moved. Add stake/odds lines for every side before settling."
    );
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

  // Record wallet IOUs before marking completed so a failed RPC can be retried
  const { error: obligError } = await supabase.rpc("record_event_obligations", {
    p_event_id: eventId,
  });
  if (obligError) fail(obligError.message);

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
  revalidatePath("/wallet");
  revalidatePath("/trips");
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
