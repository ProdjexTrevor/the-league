import Link from "next/link";
import { redirect } from "next/navigation";

import {
  markCounterpartyPaid,
  updateVenmoUsername,
} from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { venmoPayUrl } from "@/lib/venmo";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/wallet");

  const { data: me } = await supabase
    .from("profiles")
    .select("display_name, venmo_username")
    .eq("id", user.id)
    .single();

  const [{ data: owedRows }, { data: dueRows }] = await Promise.all([
    supabase
      .from("wallet_obligations")
      .select("id, to_user_id, amount, event_id, status, events(title)")
      .eq("from_user_id", user.id)
      .eq("status", "open")
      .order("created_at", { ascending: false }),
    supabase
      .from("wallet_obligations")
      .select("id, from_user_id, amount, event_id, status, events(title)")
      .eq("to_user_id", user.id)
      .eq("status", "open")
      .order("created_at", { ascending: false }),
  ]);

  // Aggregate by counterparty for pay buttons
  const owedByPerson = new Map<
    string,
    { amount: number; obligationIds: string[] }
  >();
  for (const row of owedRows ?? []) {
    const cur = owedByPerson.get(row.to_user_id) ?? {
      amount: 0,
      obligationIds: [],
    };
    cur.amount += Number(row.amount);
    cur.obligationIds.push(row.id);
    owedByPerson.set(row.to_user_id, cur);
  }

  const counterpartyIds = [
    ...new Set([
      ...[...owedByPerson.keys()],
      ...(dueRows ?? []).map((r) => r.from_user_id),
    ]),
  ];

  const { data: people } =
    counterpartyIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, display_name, venmo_username")
          .in("id", counterpartyIds)
      : { data: [] };

  const personById = new Map(people?.map((p) => [p.id, p]) ?? []);

  const totalOwed = [...owedByPerson.values()].reduce(
    (s, v) => s + v.amount,
    0
  );
  const totalDue = (dueRows ?? []).reduce((s, r) => s + Number(r.amount), 0);

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-8 pb-20 sm:px-6 sm:py-10">
      <div className="flex items-center justify-between gap-4">
        <Link href="/app" className="font-display text-2xl text-fg">
          THE LEAGUE
        </Link>
        <Link href="/app" className="shrink-0 text-sm text-muted hover:text-fg">
          Dashboard
        </Link>
      </div>

      <h1 className="mt-10 font-display text-4xl text-fg sm:text-5xl">Wallet</h1>
      <p className="mt-3 text-sm text-muted">
        Track what you owe after settled games. Pay opens Venmo with their
        username filled in.
      </p>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="rounded-sm border border-line px-4 py-4">
          <p className="text-xs uppercase tracking-wider text-muted">You owe</p>
          <p className="mt-2 font-display text-4xl text-danger">
            ${totalOwed.toFixed(2)}
          </p>
        </div>
        <div className="rounded-sm border border-line px-4 py-4">
          <p className="text-xs uppercase tracking-wider text-muted">Owed to you</p>
          <p className="mt-2 font-display text-4xl text-accent">
            ${totalDue.toFixed(2)}
          </p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Your Venmo</h2>
        <form action={updateVenmoUsername} className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
              @
            </span>
            <input
              name="venmo_username"
              required
              defaultValue={me?.venmo_username ?? ""}
              placeholder="venmo-username"
              className="w-full rounded-sm border border-line bg-bg-elevated py-2.5 pl-7 pr-3 text-sm outline-none focus:border-accent"
            />
          </div>
          <button
            type="submit"
            className="rounded-sm border border-line px-4 py-2.5 text-sm hover:border-fg/40 sm:w-auto"
          >
            Save
          </button>
        </form>
        {!me?.venmo_username && (
          <p className="mt-2 text-sm text-danger">
            Add your Venmo so others can pay you quickly.
          </p>
        )}
      </section>

      <section className="mt-14">
        <h2 className="text-lg font-semibold">Pay players</h2>
        {owedByPerson.size === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Nothing to pay right now. Settle a game to build your wallet.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {[...owedByPerson.entries()].map(([toId, { amount }]) => {
              const person = personById.get(toId);
              const venmo = person?.venmo_username;
              const payHref = venmo
                ? venmoPayUrl({
                    username: venmo,
                    amount,
                    note: "The League payout",
                  })
                : null;

              return (
                <li
                  key={toId}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">
                      {person?.display_name ?? "Player"}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">
                      {venmo ? `@${venmo}` : "No Venmo on file"} · $
                      {amount.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {payHref ? (
                      <a
                        href={payHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-sm bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink hover:brightness-110"
                      >
                        Pay on Venmo
                      </a>
                    ) : (
                      <span className="rounded-sm border border-line px-4 py-2.5 text-sm text-muted">
                        Waiting for Venmo
                      </span>
                    )}
                    <form action={markCounterpartyPaid}>
                      <input type="hidden" name="counterparty_id" value={toId} />
                      <button
                        type="submit"
                        className="rounded-sm border border-line px-4 py-2.5 text-sm hover:border-fg/40"
                      >
                        Mark paid
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-14">
        <h2 className="text-lg font-semibold">Incoming</h2>
        {(dueRows ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nobody owes you open amounts.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {(dueRows ?? []).map((row) => {
              const person = personById.get(row.from_user_id);
              const event = Array.isArray(row.events)
                ? row.events[0]
                : row.events;
              return (
                <li
                  key={row.id}
                  className="flex items-start justify-between gap-3 py-3 text-sm sm:items-center sm:gap-4"
                >
                  <div className="min-w-0">
                    <p className="break-words font-medium">
                      {person?.display_name ?? "Player"}
                    </p>
                    <p className="break-words text-muted">
                      {event?.title ?? "Event"} · ${Number(row.amount).toFixed(2)}
                    </p>
                  </div>
                  <span className="shrink-0 text-accent">Due</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
