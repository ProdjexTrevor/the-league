import Link from "next/link";
import { redirect } from "next/navigation";

import { createTrip } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TripsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/trips");

  const [{ data: memberships }, { data: profiles }] = await Promise.all([
    supabase
      .from("trip_members")
      .select("trip_id, trips(id, name, status, starts_on, ends_on, created_at)")
      .eq("user_id", user.id),
    supabase.from("profiles").select("id, display_name").order("display_name"),
  ]);

  const trips = (memberships ?? [])
    .map((m) => (Array.isArray(m.trips) ? m.trips[0] : m.trips))
    .filter(Boolean)
    .sort((a, b) => {
      const aT = a!.created_at ?? "";
      const bT = b!.created_at ?? "";
      return bT.localeCompare(aT);
    });

  const others = (profiles ?? []).filter((p) => p.id !== user.id);

  return (
    <AppShell userId={user.id}>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
        Weekend · trip · running tab
      </p>
      <h1 className="font-display text-4xl tracking-[0.04em]">
        THE <span className="text-accent">TAB</span>
      </h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        Group bets for a trip or weekend. As results land, we net who owes whom
        so you settle once — not after every beer bet.
      </p>

      <section className="mt-8 rounded-3xl border border-line bg-bg-elevated/80 p-4">
        <h2 className="font-display text-xl tracking-[0.06em]">START A TAB</h2>
        <form action={createTrip} className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              Name
            </span>
            <input
              name="name"
              required
              placeholder="Guys trip · Labor Day"
              className="mt-1.5 w-full rounded-2xl border border-line bg-bg px-4 py-3 outline-none focus:border-accent"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                Starts
              </span>
              <input
                name="starts_on"
                type="date"
                className="mt-1.5 w-full rounded-2xl border border-line bg-bg px-4 py-3 outline-none focus:border-accent"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                Ends
              </span>
              <input
                name="ends_on"
                type="date"
                className="mt-1.5 w-full rounded-2xl border border-line bg-bg px-4 py-3 outline-none focus:border-accent"
              />
            </label>
          </div>
          <fieldset>
            <legend className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              Who&apos;s on it
            </legend>
            <div className="mt-2 max-h-40 space-y-2 overflow-y-auto rounded-2xl border border-line bg-bg p-3">
              {others.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="member_id" value={p.id} />
                  {p.display_name}
                </label>
              ))}
              {others.length === 0 ? (
                <p className="text-sm text-muted">No other players yet.</p>
              ) : null}
            </div>
          </fieldset>
          <button
            type="submit"
            className="w-full rounded-2xl bg-accent py-3.5 text-sm font-bold uppercase tracking-[0.12em] text-accent-ink"
          >
            Open tab
          </button>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Your tabs</h2>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {trips.length === 0 ? (
            <li className="py-4 text-sm text-muted">No trips yet.</li>
          ) : (
            trips.map((t) => (
              <li key={t!.id} className="py-3">
                <Link
                  href={`/trips/${t!.id}`}
                  className="flex items-center justify-between gap-3 hover:text-accent"
                >
                  <span>
                    <span className="block font-medium">{t!.name}</span>
                    <span className="text-xs text-muted">
                      {t!.status}
                      {t!.starts_on ? ` · ${t!.starts_on}` : ""}
                      {t!.ends_on ? ` → ${t!.ends_on}` : ""}
                    </span>
                  </span>
                  <span className="text-xs text-accent">Open</span>
                </Link>
              </li>
            ))
          )}
        </ul>
      </section>
    </AppShell>
  );
}
