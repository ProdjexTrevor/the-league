"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

function fail(message: string): never {
  throw new Error(message);
}

export async function createLeague(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!name) fail("League name is required.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) fail("Not signed in.");

  // Ensure profile row exists (FK + display name)
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

  const { data, error } = await supabase.rpc("create_league", {
    p_name: name,
    p_description: description || null,
  });

  if (error || !data) {
    // Fallback if RPC not applied yet
    const fallback = await supabase
      .from("leagues")
      .insert({
        name,
        description: description || null,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (fallback.error || !fallback.data) {
      fail(error?.message ?? fallback.error?.message ?? "Could not create league.");
    }

    revalidatePath("/app");
    redirect(`/leagues/${fallback.data.id}`);
  }

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

export async function createGame(leagueId: string, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const gameTypeId = String(formData.get("game_type_id") ?? "");
  const wagerUnits = Number(formData.get("wager_units") ?? 0);
  const notes = String(formData.get("notes") ?? "").trim();

  if (!title || !gameTypeId) fail("Title and game type are required.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) fail("Not signed in.");

  const { data: game, error } = await supabase
    .from("games")
    .insert({
      league_id: leagueId,
      game_type_id: gameTypeId,
      title,
      wager_units: Number.isFinite(wagerUnits) ? wagerUnits : 0,
      notes: notes || null,
      created_by: user.id,
      status: "open",
    })
    .select("id")
    .single();

  if (error || !game) fail(error?.message ?? "Could not create game.");

  await supabase.from("game_players").insert({
    game_id: game.id,
    user_id: user.id,
  });

  revalidatePath(`/leagues/${leagueId}`);
  redirect(`/leagues/${leagueId}/games/${game.id}`);
}

export async function completeGame(
  leagueId: string,
  gameId: string,
  formData: FormData
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) fail("Not signed in.");

  const { data: game } = await supabase
    .from("games")
    .select("id, wager_units, league_id")
    .eq("id", gameId)
    .single();

  if (!game) fail("Game not found.");

  const { data: players } = await supabase
    .from("game_players")
    .select("user_id")
    .eq("game_id", gameId);

  if (!players?.length) fail("Add players before completing.");

  const placements = players.map((p) => ({
    user_id: p.user_id,
    placement: Number(formData.get(`placement_${p.user_id}`)),
  }));

  if (placements.some((p) => !p.placement || p.placement < 1)) {
    fail("Every player needs a placement (1 = winner).");
  }

  const winners = placements.filter((p) => p.placement === 1);
  if (winners.length !== 1) {
    fail("Exactly one winner (placement 1) is required.");
  }

  const wager = Number(game.wager_units) || 0;
  const pot = wager * players.length;
  const winnerId = winners[0].user_id;

  for (const p of placements) {
    const units_delta = p.user_id === winnerId ? pot - wager : -wager;
    const { error } = await supabase
      .from("game_players")
      .update({ placement: p.placement, units_delta })
      .eq("game_id", gameId)
      .eq("user_id", p.user_id);
    if (error) fail(error.message);
  }

  const { error: gameError } = await supabase
    .from("games")
    .update({
      status: "completed",
      played_at: new Date().toISOString(),
    })
    .eq("id", gameId);

  if (gameError) fail(gameError.message);

  revalidatePath(`/leagues/${leagueId}`);
  revalidatePath(`/leagues/${leagueId}/games/${gameId}`);
}

export async function addPlayerToGame(
  leagueId: string,
  gameId: string,
  formData: FormData
) {
  const userId = String(formData.get("user_id") ?? "");
  if (!userId) fail("Pick a player.");

  const supabase = await createClient();
  const { error } = await supabase.from("game_players").insert({
    game_id: gameId,
    user_id: userId,
  });

  if (error) fail(error.message);

  revalidatePath(`/leagues/${leagueId}/games/${gameId}`);
}
