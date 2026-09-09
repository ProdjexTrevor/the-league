import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { fetchProGameFinal, type ProSport } from "@/lib/pro-games";
import {
  gradeProPick,
  normalizeProPick,
  type ProPick,
} from "@/lib/pro-pick";

type Admin = SupabaseClient<Database>;

export type ReconSummary = {
  scanned: number;
  graded: number;
  settled: number;
  pushed: number;
  skipped: number;
  errors: string[];
  details: Array<{
    eventId: string;
    title: string;
    result: string;
    settled: boolean;
  }>;
};

async function settleCustomTwoPlayer(
  admin: Admin,
  eventId: string,
  outcomes: Map<string, "win" | "loss" | "draw">
) {
  const { data: event } = await admin
    .from("events")
    .select("id, status, wager_mode")
    .eq("id", eventId)
    .single();
  if (!event || event.status === "completed") return false;
  if (event.wager_mode !== "custom") return false;

  const { data: players } = await admin
    .from("event_players")
    .select("user_id, invite_status")
    .eq("event_id", eventId);

  const accepted = (players ?? []).filter(
    (p) => (p.invite_status ?? "accepted") === "accepted"
  );
  if (accepted.length < 2) return false;
  if ((players ?? []).some((p) => p.invite_status === "pending")) return false;

  const { data: lines } = await admin
    .from("wager_lines")
    .select("player_id, stake_units")
    .eq("event_id", eventId);

  const stakeByPlayer = new Map<string, number>();
  for (const p of accepted) stakeByPlayer.set(p.user_id, 0);
  for (const line of lines ?? []) {
    if (!line.player_id) continue;
    const amount = Number(line.stake_units) || 0;
    if (!(amount > 0)) continue;
    stakeByPlayer.set(
      line.player_id,
      (stakeByPlayer.get(line.player_id) ?? 0) + amount
    );
  }

  const deltas = new Map<string, number>();
  for (const p of accepted) deltas.set(p.user_id, 0);

  const isPush = [...outcomes.values()].every((o) => o === "draw");
  if (!isPush) {
    const winners = accepted.filter((p) => outcomes.get(p.user_id) === "win");
    const losers = accepted.filter((p) => outcomes.get(p.user_id) === "loss");
    let losersPot = 0;
    for (const p of losers) {
      const s = stakeByPlayer.get(p.user_id) ?? 0;
      if (s > 0) {
        losersPot += s;
        deltas.set(p.user_id, (deltas.get(p.user_id) ?? 0) - s);
      }
    }
    if (losersPot > 0 && winners.length > 0) {
      const share = losersPot / winners.length;
      for (const w of winners) {
        deltas.set(w.user_id, (deltas.get(w.user_id) ?? 0) + share);
      }
    }
  }

  for (const [uid, raw] of deltas) {
    deltas.set(uid, Math.round(raw * 100) / 100);
  }

  for (const p of accepted) {
    const outcome = outcomes.get(p.user_id) ?? "draw";
    const { error } = await admin
      .from("event_players")
      .update({
        outcome,
        units_delta: deltas.get(p.user_id) ?? 0,
      })
      .eq("event_id", eventId)
      .eq("user_id", p.user_id);
    if (error) throw new Error(error.message);
  }

  const { error: obligError } = await admin.rpc("record_event_obligations", {
    p_event_id: eventId,
  });
  if (obligError) throw new Error(obligError.message);

  const { error: eventError } = await admin
    .from("events")
    .update({
      status: "completed",
      played_at: new Date().toISOString(),
    })
    .eq("id", eventId);
  if (eventError) throw new Error(eventError.message);

  return true;
}

export async function runProGameRecon(admin: Admin): Promise<ReconSummary> {
  const summary: ReconSummary = {
    scanned: 0,
    graded: 0,
    settled: 0,
    pushed: 0,
    skipped: 0,
    errors: [],
    details: [],
  };

  const { data: events, error } = await admin
    .from("events")
    .select("id, title, status, created_by, pro_pick")
    .eq("kind", "bet")
    .neq("status", "cancelled")
    .not("pro_pick", "is", null)
    .limit(200);

  if (error) {
    summary.errors.push(error.message);
    return summary;
  }

  for (const event of events ?? []) {
    summary.scanned += 1;
    const pick = normalizeProPick(event.pro_pick);
    if (!pick) {
      summary.skipped += 1;
      continue;
    }
    if (pick.graded || event.status === "completed") {
      summary.skipped += 1;
      continue;
    }
    if (!pick.side || pick.marketKind === "game") {
      summary.skipped += 1;
      continue;
    }

    try {
      const final = await fetchProGameFinal(
        pick.sport as ProSport,
        pick.espnEventId
      );
      if (
        !final ||
        !final.completed ||
        final.homeScore == null ||
        final.awayScore == null
      ) {
        summary.skipped += 1;
        continue;
      }

      const result = gradeProPick(pick, final.homeScore, final.awayScore);
      const nextPick: ProPick = {
        ...pick,
        graded: true,
        result,
        finalHome: final.homeScore,
        finalAway: final.awayScore,
        gradedAt: new Date().toISOString(),
        note: final.status,
      };

      const { data: players } = await admin
        .from("event_players")
        .select("user_id, invite_status")
        .eq("event_id", event.id);

      const pending = (players ?? []).some((p) => p.invite_status === "pending");
      const accepted = (players ?? []).filter(
        (p) => (p.invite_status ?? "accepted") === "accepted"
      );

      let settled = false;
      if (!pending && accepted.length >= 2 && result !== "ungradable") {
        const outcomes = new Map<string, "win" | "loss" | "draw">();
        for (const p of accepted) {
          if (result === "push") {
            outcomes.set(p.user_id, "draw");
          } else if (p.user_id === pick.pickerUserId) {
            outcomes.set(p.user_id, result === "win" ? "win" : "loss");
          } else {
            outcomes.set(p.user_id, result === "win" ? "loss" : "win");
          }
        }
        settled = await settleCustomTwoPlayer(admin, event.id, outcomes);
      }

      const { error: updateError } = await admin
        .from("events")
        .update({ pro_pick: nextPick })
        .eq("id", event.id);
      if (updateError) throw new Error(updateError.message);

      summary.graded += 1;
      if (result === "push") summary.pushed += 1;
      if (settled) summary.settled += 1;
      summary.details.push({
        eventId: event.id,
        title: event.title,
        result,
        settled,
      });
    } catch (e) {
      summary.errors.push(
        `${event.id}: ${e instanceof Error ? e.message : "recon failed"}`
      );
    }
  }

  return summary;
}
