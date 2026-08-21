import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { venmoPayUrl } from "@/lib/venmo";

export const dynamic = "force-dynamic";

type Friend = {
  id: string;
  display_name: string | null;
  venmo_username: string | null;
  leagues: string[];
  theyOweYou: number;
  youOweThem: number;
};

export default async function FriendsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/friends");

  await supabase.rpc("repair_my_wallet_obligations");

  const [{ data: memberships }, { data: owedRows }, { data: dueRows }] =
    await Promise.all([
      supabase
        .from("league_members")
        .select("league_id, leagues(id, name)")
        .eq("user_id", user.id),
      supabase
        .from("wallet_obligations")
        .select("to_user_id, amount")
        .eq("from_user_id", user.id)
        .eq("status", "open"),
      supabase
        .from("wallet_obligations")
        .select("from_user_id, amount")
        .eq("to_user_id", user.id)
        .eq("status", "open"),
    ]);

  const leagueIds =
    memberships
      ?.map((m) => {
        const league = Array.isArray(m.leagues) ? m.leagues[0] : m.leagues;
        return league?.id as string | undefined;
      })
      .filter(Boolean) ?? [];

  const leagueNameById = new Map<string, string>();
  for (const m of memberships ?? []) {
    const league = Array.isArray(m.leagues) ? m.leagues[0] : m.leagues;
    if (league?.id) leagueNameById.set(league.id, league.name);
  }

  const { data: roster } =
    leagueIds.length > 0
      ? await supabase
          .from("league_members")
          .select("user_id, league_id, profiles(id, display_name, venmo_username)")
          .in("league_id", leagueIds as string[])
      : { data: [] };

  const friendMap = new Map<string, Friend>();

  for (const row of roster ?? []) {
    if (row.user_id === user.id) continue;
    const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    if (!p?.id) continue;

    const existing = friendMap.get(p.id);
    const leagueName = leagueNameById.get(row.league_id) ?? null;
    if (existing) {
      if (leagueName && !existing.leagues.includes(leagueName)) {
        existing.leagues.push(leagueName);
      }
    } else {
      friendMap.set(p.id, {
        id: p.id,
        display_name: p.display_name,
        venmo_username: p.venmo_username,
        leagues: leagueName ? [leagueName] : [],
        theyOweYou: 0,
        youOweThem: 0,
      });
    }
  }

  for (const row of owedRows ?? []) {
    const f = friendMap.get(row.to_user_id);
    if (f) f.youOweThem += Number(row.amount);
  }
  for (const row of dueRows ?? []) {
    const f = friendMap.get(row.from_user_id);
    if (f) f.theyOweYou += Number(row.amount);
  }

  const friends = Array.from(friendMap.values()).sort((a, b) => {
    const aNet = a.theyOweYou - a.youOweThem;
    const bNet = b.theyOweYou - b.youOweThem;
    if (Math.abs(bNet) !== Math.abs(aNet)) {
      return Math.abs(bNet) - Math.abs(aNet);
    }
    return (a.display_name ?? "").localeCompare(b.display_name ?? "");
  });

  return (
    <AppShell userId={user.id} title="Friends">
      <p className="mb-4 text-sm text-muted">
        Your crew from leagues — bet, pay, or check the scoreboard.
      </p>

      {friends.length === 0 ? (
        <div className="rounded-2xl border border-line bg-bg-elevated/70 px-4 py-6 text-center">
          <p className="text-sm text-muted">
            No friends yet. Join or start a league to build your crew.
          </p>
          <Link
            href="/create"
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink"
          >
            Find your crew
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {friends.map((friend) => {
            const net = friend.theyOweYou - friend.youOweThem;
            const initial = (friend.display_name ?? "?").charAt(0).toUpperCase();
            const payHref =
              friend.youOweThem > 0 && friend.venmo_username
                ? venmoPayUrl({
                    username: friend.venmo_username,
                    amount: friend.youOweThem,
                    note: "The League payout",
                  })
                : null;

            return (
              <li
                key={friend.id}
                className="rounded-2xl border border-line bg-bg-elevated/70 p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-bold text-accent">
                    {initial}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {friend.display_name ?? "Player"}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {friend.leagues.length > 0
                            ? friend.leagues.join(" · ")
                            : "League buddy"}
                          {friend.venmo_username
                            ? ` · @${friend.venmo_username}`
                            : ""}
                        </p>
                      </div>
                      <p
                        className={`shrink-0 font-display text-xl ${
                          net > 0
                            ? "text-accent"
                            : net < 0
                              ? "text-danger"
                              : "text-muted"
                        }`}
                      >
                        {net > 0
                          ? `+$${net.toFixed(0)}`
                          : net < 0
                            ? `-$${Math.abs(net).toFixed(0)}`
                            : "$0"}
                      </p>
                    </div>

                    <p className="mt-2 text-xs text-muted">
                      {friend.theyOweYou > 0
                        ? `They owe you $${friend.theyOweYou.toFixed(0)}`
                        : null}
                      {friend.theyOweYou > 0 && friend.youOweThem > 0
                        ? " · "
                        : null}
                      {friend.youOweThem > 0
                        ? `You owe $${friend.youOweThem.toFixed(0)}`
                        : null}
                      {friend.theyOweYou === 0 && friend.youOweThem === 0
                        ? "Settled up"
                        : null}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={`/bet?against=${friend.id}`}
                        className="inline-flex min-h-10 items-center rounded-xl bg-accent px-3.5 text-xs font-semibold text-accent-ink"
                      >
                        Bet
                      </Link>
                      <Link
                        href={`/players/${friend.id}`}
                        className="inline-flex min-h-10 items-center rounded-xl border border-line px-3.5 text-xs font-semibold text-fg"
                      >
                        Stats
                      </Link>
                      {payHref ? (
                        <a
                          href={payHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-10 items-center rounded-xl border border-line px-3.5 text-xs font-semibold text-accent"
                        >
                          Pay Venmo
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-8 text-center text-xs text-muted">
        Need another crew?{" "}
        <Link href="/create" className="text-accent hover:underline">
          Create or join a league
        </Link>
      </p>
    </AppShell>
  );
}
