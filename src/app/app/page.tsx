import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { BrandPill } from "@/components/brand";
import { TheBook } from "@/components/the-book";
import { createClient } from "@/lib/supabase/server";
import { venmoPayUrl } from "@/lib/venmo";

export const dynamic = "force-dynamic";

function money(n: number) {
  const abs = Math.abs(n);
  const formatted = abs % 1 === 0 ? abs.toFixed(0) : abs.toFixed(2);
  if (n > 0) return `+$${formatted}`;
  if (n < 0) return `-$${formatted}`;
  return `$${formatted}`;
}

export default async function AppPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.rpc("repair_my_wallet_obligations");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const [{ data: myEvents }, { data: owedRows }, { data: dueRows }] =
    await Promise.all([
      supabase
        .from("events")
        .select(
          "id, title, kind, status, entry_fee_units, default_stake_units, wager_mode, notes, created_at, league_id"
        )
        .eq("created_by", user.id)
        .order("created_at", { ascending: false })
        .limit(40),
      supabase
        .from("wallet_obligations")
        .select("id, to_user_id, amount, events(title)")
        .eq("from_user_id", user.id)
        .eq("status", "open"),
      supabase
        .from("wallet_obligations")
        .select("id, from_user_id, amount, events(title)")
        .eq("to_user_id", user.id)
        .eq("status", "open"),
    ]);

  const { data: playing } = await supabase
    .from("event_players")
    .select(
      "event_id, invite_status, events(id, title, kind, status, entry_fee_units, default_stake_units, wager_mode, notes, created_at, league_id)"
    )
    .eq("user_id", user.id)
    .limit(50);

  const eventMap = new Map<string, NonNullable<(typeof myEvents)>[number]>();
  myEvents?.forEach((e) => eventMap.set(e.id, e));
  playing?.forEach((row) => {
    const e = Array.isArray(row.events) ? row.events[0] : row.events;
    if (e) eventMap.set(e.id, e);
  });
  const events = Array.from(eventMap.values()).sort(
    (a, b) => +new Date(b.created_at) - +new Date(a.created_at)
  );

  const liveStake = events
    .filter((e) => e.status === "open" || e.status === "in_progress")
    .reduce(
      (s, e) => s + Number(e.default_stake_units ?? e.entry_fee_units ?? 0),
      0
    );

  const owedByPerson = new Map<string, number>();
  for (const row of owedRows ?? []) {
    owedByPerson.set(
      row.to_user_id,
      (owedByPerson.get(row.to_user_id) ?? 0) + Number(row.amount)
    );
  }
  const dueByPerson = new Map<string, number>();
  for (const row of dueRows ?? []) {
    dueByPerson.set(
      row.from_user_id,
      (dueByPerson.get(row.from_user_id) ?? 0) + Number(row.amount)
    );
  }

  const totalOwed = [...owedByPerson.values()].reduce((s, v) => s + v, 0);
  const totalDue = [...dueByPerson.values()].reduce((s, v) => s + v, 0);
  const net = totalDue - totalOwed;

  const personIds = [
    ...new Set([...owedByPerson.keys(), ...dueByPerson.keys()]),
  ];

  const { data: people } =
    personIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, display_name, venmo_username")
          .in("id", personIds)
      : { data: [] };
  const personById = new Map(people?.map((p) => [p.id, p]) ?? []);

  const pendingInvites =
    playing
      ?.filter((row) => row.invite_status === "pending")
      .map((row) => {
        const e = Array.isArray(row.events) ? row.events[0] : row.events;
        return e;
      })
      .filter(Boolean) ?? [];

  return (
    <AppShell userId={user.id}>
      <div className="animate-rise">
        <BrandPill>No bookies · just friends</BrandPill>
        <p className="mt-3 text-sm text-muted">
          Hey {profile?.display_name ?? "player"}
        </p>
      </div>

      <section className="net-card animate-rise-delay mt-5 rounded-2xl bg-bg-elevated/80 px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          Net position
        </p>
        <p
          className={`mt-1 font-display text-4xl ${
            net >= 0 ? "text-accent" : "text-danger"
          }`}
        >
          {money(net)}
        </p>
        <p className="mt-1 text-sm text-muted">
          {liveStake > 0
            ? `$${liveStake.toFixed(0)} still live`
            : "No live stakes"}
        </p>
      </section>

      {pendingInvites.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-base font-semibold">Invites</h2>
          <ul className="mt-2 space-y-2">
            {pendingInvites.map((event) =>
              event ? (
                <li key={event.id}>
                  <Link
                    href={`/events/${event.id}`}
                    className="flex min-h-12 items-center justify-between rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3"
                  >
                    <span className="font-medium">{event.title}</span>
                    <span className="text-xs uppercase tracking-wider text-accent">
                      Accept
                    </span>
                  </Link>
                </li>
              ) : null
            )}
          </ul>
        </section>
      ) : null}

      <section className="mt-6 space-y-5">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold">They owe you</h2>
            <p className="font-display text-2xl text-accent">
              ${totalDue.toFixed(0)}
            </p>
          </div>
          {dueByPerson.size === 0 ? (
            <p className="mt-2 text-sm text-muted">Nobody yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {[...dueByPerson.entries()].map(([id, amount]) => {
                const person = personById.get(id);
                const initial = (person?.display_name ?? "?").charAt(0);
                return (
                  <li
                    key={id}
                    className="flex min-h-11 items-center justify-between gap-3 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent">
                        {initial}
                      </span>
                      <span className="truncate">
                        {person?.display_name ?? "Player"}
                      </span>
                    </span>
                    <span className="font-semibold text-accent">
                      ${amount.toFixed(0)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold">You owe</h2>
            <p className="font-display text-2xl text-danger">
              ${totalOwed.toFixed(0)}
            </p>
          </div>
          {owedByPerson.size === 0 ? (
            <p className="mt-2 text-sm text-muted">All clear.</p>
          ) : (
            <ul className="mt-2 space-y-3">
              {[...owedByPerson.entries()].map(([id, amount]) => {
                const person = personById.get(id);
                const initial = (person?.display_name ?? "?").charAt(0);
                const payHref = person?.venmo_username
                  ? venmoPayUrl({
                      username: person.venmo_username,
                      amount,
                      note: "The League payout",
                    })
                  : null;
                return (
                  <li key={id} className="text-sm">
                    <div className="flex min-h-11 items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fg/10 text-xs font-bold">
                          {initial}
                        </span>
                        <span className="truncate">
                          {person?.display_name ?? "Player"}
                        </span>
                      </span>
                      <span className="font-semibold">${amount.toFixed(0)}</span>
                    </div>
                    {payHref ? (
                      <a
                        href={payHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex min-h-10 items-center text-xs font-semibold text-accent"
                      >
                        Pay on Venmo →
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <div className="animate-rise-delay-2">
        <TheBook events={events} />
      </div>
    </AppShell>
  );
}
