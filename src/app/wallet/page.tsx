import Link from "next/link";
import { redirect } from "next/navigation";

import {
  markCounterpartyPaid,
  updateVenmoUsername,
} from "@/app/actions";
import { Brand } from "@/components/brand";
import { createClient } from "@/lib/supabase/server";
import { venmoPayUrl } from "@/lib/venmo";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/wallet");

  await supabase.rpc("repair_my_wallet_obligations");

  const { data: me } = await supabase
    .from("profiles")
    .select("display_name, venmo_username")
    .eq("id", user.id)
    .single();

  const [{ data: owedRows, error: owedError }, { data: dueRows, error: dueError }] =
    await Promise.all([
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

  const walletError = owedError?.message ?? dueError?.message ?? null;

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
    <main className="mx-auto min-h-screen w-full max-w-lg px-4 py-6 pb-24 sm:px-5 sm:py-8">
      <div className="flex items-center justify-between gap-4">
        <Brand href="/app" size="sm" />
        <Link href="/app" className="text-sm text-muted hover:text-fg">
          Book
        </Link>
      </div>

      <h1 className="mt-8 text-2xl font-semibold tracking-tight">Wallet</h1>
      <p className="mt-2 text-sm text-muted">
        Pay opens Venmo with their username filled in.
      </p>
      {walletError ? (
        <p className="mt-4 text-sm text-danger">
          Couldn’t load wallet: {walletError}
        </p>
      ) : null}

      <section className="mt-8 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-line bg-bg-elevated/70 px-4 py-4">
          <p className="text-[11px] uppercase tracking-wider text-muted">You owe</p>
          <p className="mt-2 font-display text-3xl text-danger">
            ${totalOwed.toFixed(0)}
          </p>
        </div>
        <div className="net-card rounded-2xl bg-bg-elevated/70 px-4 py-4">
          <p className="text-[11px] uppercase tracking-wider text-muted">
            Owed to you
          </p>
          <p className="mt-2 font-display text-3xl text-accent">
            ${totalDue.toFixed(0)}
          </p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Your Venmo</h2>
        <form
          action={updateVenmoUsername}
          className="mt-4 flex flex-col gap-3 sm:flex-row"
        >
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
              @
            </span>
            <input
              name="venmo_username"
              required
              defaultValue={me?.venmo_username ?? ""}
              placeholder="venmo-username"
              className="w-full rounded-xl border border-line bg-bg-elevated py-3 pl-8 pr-3 text-sm outline-none focus:border-accent"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl border border-line px-4 py-3 text-sm hover:border-fg/40"
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

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Pay players</h2>
        {owedByPerson.size === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing to pay right now.</p>
        ) : (
          <ul className="mt-4 space-y-3">
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
                  className="rounded-2xl border border-line bg-bg-elevated/70 p-4"
                >
                  <div>
                    <p className="font-medium">
                      {person?.display_name ?? "Player"}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">
                      {venmo ? `@${venmo}` : "No Venmo"} · ${amount.toFixed(2)}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {payHref ? (
                      <a
                        href={payHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink hover:brightness-110"
                      >
                        Pay on Venmo
                      </a>
                    ) : (
                      <span className="rounded-xl border border-line px-4 py-2.5 text-sm text-muted">
                        Waiting for Venmo
                      </span>
                    )}
                    <form action={markCounterpartyPaid}>
                      <input type="hidden" name="counterparty_id" value={toId} />
                      <button
                        type="submit"
                        className="rounded-xl border border-line px-4 py-2.5 text-sm hover:border-fg/40"
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

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Incoming</h2>
        {(dueRows ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nobody owes you open amounts.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {(dueRows ?? []).map((row) => {
              const person = personById.get(row.from_user_id);
              const event = Array.isArray(row.events)
                ? row.events[0]
                : row.events;
              return (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {person?.display_name ?? "Player"}
                    </p>
                    <p className="truncate text-muted">
                      {event?.title ?? "Event"}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold text-accent">
                    ${Number(row.amount).toFixed(0)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
