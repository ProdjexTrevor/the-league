import { supabase } from "@/lib/supabase";
import { profit, type ScoringMode } from "@/lib/wager";

export type SettleResultInput = {
  user_id: string;
  score?: number | null;
  placement?: number | null;
  outcome?: string | null;
};

/**
 * Mirrors web `settleEvent` so mobile can complete games/bets offline of Next.
 */
export async function settleEvent(
  eventId: string,
  resultsInput: SettleResultInput[]
): Promise<{ error: string | null }> {
  const { data: event, error: eventLoadError } = await supabase
    .from("events")
    .select(
      "id, league_id, wager_mode, default_stake_units, entry_fee_units, status, catalog_id"
    )
    .eq("id", eventId)
    .single();

  if (eventLoadError || !event) {
    return { error: eventLoadError?.message ?? "Event not found." };
  }
  if (event.status === "completed") {
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
      if (repairError) {
        return { error: repairError.message };
      }
      return {
        error:
          "Already settled. Missing wallet IOUs were created — check Wallet.",
      };
    }
    return { error: "Already settled." };
  }

  const { data: catalog } = await supabase
    .from("game_catalog")
    .select("scoring_mode")
    .eq("id", event.catalog_id)
    .single();

  const scoringMode = (catalog?.scoring_mode ?? "placement") as ScoringMode;

  const { data: allPlayers, error: playersError } = await supabase
    .from("event_players")
    .select("user_id, side_label, invite_status")
    .eq("event_id", eventId);

  if (playersError) return { error: playersError.message };

  const players = (allPlayers ?? []).filter(
    (p) => (p.invite_status ?? "accepted") === "accepted"
  );

  if (!players.length) {
    return { error: "Wait for players to accept before settling." };
  }
  const pending = (allPlayers ?? []).filter(
    (p) => p.invite_status === "pending"
  );
  if (pending.length > 0) {
    return {
      error: "Everyone invited must accept (or decline) before settling.",
    };
  }

  type ResultRow = {
    user_id: string;
    score: number | null;
    placement: number | null;
    outcome: string | null;
  };

  const byId = new Map(resultsInput.map((r) => [r.user_id, r]));
  const results: ResultRow[] = players.map((p) => {
    const input = byId.get(p.user_id);
    return {
      user_id: p.user_id,
      score:
        input?.score != null && String(input.score) !== ""
          ? Number(input.score)
          : null,
      placement:
        input?.placement != null && String(input.placement) !== ""
          ? Number(input.placement)
          : null,
      outcome: String(input?.outcome ?? "").trim() || null,
    };
  });

  let winnerIds: string[] = [];

  if (scoringMode === "placement" || scoringMode === "custom") {
    if (results.some((r) => !r.placement || r.placement < 1)) {
      return { error: "Every player needs a placement (1 = winner)." };
    }
    winnerIds = results.filter((r) => r.placement === 1).map((r) => r.user_id);
  } else if (scoringMode === "higher_wins" || scoringMode === "lower_wins") {
    if (results.some((r) => r.score === null || Number.isNaN(r.score))) {
      return { error: "Every player needs a score." };
    }
    const sorted = [...results].sort((a, b) =>
      scoringMode === "higher_wins"
        ? (b.score ?? 0) - (a.score ?? 0)
        : (a.score ?? 0) - (b.score ?? 0)
    );
    const best = sorted[0].score;
    winnerIds = sorted.filter((r) => r.score === best).map((r) => r.user_id);
    for (const r of results) {
      r.placement = sorted.findIndex((s) => s.user_id === r.user_id) + 1;
    }
  } else if (scoringMode === "head_to_head") {
    if (results.some((r) => !r.outcome)) {
      return { error: "Every player needs win/loss/draw." };
    }
    winnerIds = results.filter((r) => r.outcome === "win").map((r) => r.user_id);
  }

  if (winnerIds.length === 0) {
    return { error: "Could not determine a winner." };
  }

  const deltas = new Map<string, number>();
  players.forEach((p) => deltas.set(p.user_id, 0));

  const wagerMode = event.wager_mode;
  const stake = Number(event.default_stake_units) || 0;
  const entryFee = Number(event.entry_fee_units) || 0;

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

      if (!line.side_label) continue;
      const side = line.side_label;
      const backedPlayers = players.filter((p) => p.side_label === side);
      const opposingPlayers = players.filter((p) => p.side_label !== side);
      if (backedPlayers.length === 0 || opposingPlayers.length === 0) continue;

      const sideWon = backedPlayers.some((p) => winnerIds.includes(p.user_id));

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

  for (const [uid, raw] of deltas) {
    deltas.set(uid, Math.round(raw * 100) / 100);
  }

  const moneyConfigured =
    entryFee > 0 ||
    (wagerMode === "pot" && stake > 0) ||
    wagerMode === "custom" ||
    wagerMode === "odds";
  const moneyMoved = [...deltas.values()].some((d) => d !== 0);
  if (
    moneyConfigured &&
    !moneyMoved &&
    (wagerMode === "custom" || wagerMode === "odds")
  ) {
    return {
      error:
        "No money moved. Add stake/odds lines for every side before settling.",
    };
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
    if (error) return { error: error.message };
  }

  const { error: obligError } = await supabase.rpc("record_event_obligations", {
    p_event_id: eventId,
  });
  if (obligError) return { error: obligError.message };

  const { error: eventError } = await supabase
    .from("events")
    .update({
      status: "completed",
      played_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  if (eventError) return { error: eventError.message };

  return { error: null };
}
