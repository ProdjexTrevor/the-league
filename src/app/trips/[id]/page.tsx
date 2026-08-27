import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { addTripMembers, closeTrip } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { tallyTripObligations } from "@/lib/trip-tally";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function TripPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/trips/${id}`);

  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", id)
    .single();
  if (!trip) notFound();

  const [
    { data: members },
    { data: events },
    { data: profiles },
  ] = await Promise.all([
    supabase
      .from("trip_members")
      .select("user_id, profiles(display_name)")
      .eq("trip_id", id),
    supabase
      .from("events")
      .select("id, title, status, kind, created_at")
      .eq("trip_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, display_name").order("display_name"),
  ]);

  const memberIds = new Set((members ?? []).map((m) => m.user_id));
  const nameById = new Map<string, string>();
  for (const m of members ?? []) {
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    nameById.set(m.user_id, p?.display_name ?? "Player");
  }

  const eventIds = (events ?? []).map((e) => e.id);
  const { data: obligations } =
    eventIds.length > 0
      ? await supabase
          .from("wallet_obligations")
          .select("from_user_id, to_user_id, amount, status, event_id")
          .in("event_id", eventIds)
          .eq("status", "open")
      : { data: [] };

  const { personNets, edges } = tallyTripObligations(obligations ?? []);

  const available = (profiles ?? []).filter((p) => !memberIds.has(p.id));
  const isCreator = trip.created_by === user.id;

  async function addMembersAction(formData: FormData) {
    "use server";
    return addTripMembers(id, formData);
  }
  async function closeAction() {
    "use server";
    return closeTrip(id);
  }

  return (
    <AppShell userId={user.id}>
      <Link href="/trips" className="text-sm text-muted hover:text-fg">
        ← Tabs
      </Link>

      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
        {trip.status === "open" ? "Open tab" : "Closed"}
      </p>
      <h1 className="mt-1 font-display text-4xl tracking-[0.04em]">{trip.name}</h1>
      <p className="mt-2 text-sm text-muted">
        {[trip.starts_on, trip.ends_on].filter(Boolean).join(" → ") ||
          "No dates set"}
        {" · "}
        {(events ?? []).length} bet{(events ?? []).length === 1 ? "" : "s"}
      </p>

      <section className="mt-8 rounded-3xl border border-accent/30 bg-accent/5 p-4">
        <h2 className="font-display text-xl tracking-[0.06em]">RUNNING TALLY</h2>
        <p className="mt-1 text-xs text-muted">
          Settled bets only. Positive = owed money. Negative = you owe.
        </p>

        <ul className="mt-4 space-y-2">
          {personNets.length === 0 ? (
            <li className="text-sm text-muted">
              No settled money on this tab yet. Lock bets to this trip, then both
              sides confirm winners.
            </li>
          ) : (
            personNets.map((p) => (
              <li
                key={p.userId}
                className="flex items-center justify-between text-sm"
              >
                <span>{nameById.get(p.userId) ?? "Player"}</span>
                <span
                  className={
                    p.net > 0
                      ? "font-semibold text-accent"
                      : p.net < 0
                        ? "font-semibold text-danger"
                        : "text-muted"
                  }
                >
                  {p.net > 0 ? "+" : ""}
                  ${p.net.toFixed(0)}
                </span>
              </li>
            ))
          )}
        </ul>

        {edges.length > 0 ? (
          <div className="mt-6 border-t border-line pt-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              Who pays whom
            </h3>
            <ul className="mt-3 space-y-2">
              {edges.map((e) => (
                <li key={`${e.fromUserId}-${e.toUserId}`} className="text-sm">
                  <span className="text-danger">
                    {nameById.get(e.fromUserId) ?? "Player"}
                  </span>
                  {" owes "}
                  <span className="text-accent">
                    {nameById.get(e.toUserId) ?? "Player"}
                  </span>
                  <span className="float-right font-semibold">
                    ${e.amount.toFixed(0)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <div className="mt-6">
        <Link
          href={`/bet?trip=${id}`}
          className="flex w-full items-center justify-center rounded-2xl bg-accent py-3.5 text-sm font-bold uppercase tracking-[0.12em] text-accent-ink"
        >
          Add a bet to this tab
        </Link>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Bets on this tab</h2>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {(events ?? []).length === 0 ? (
            <li className="py-4 text-sm text-muted">None yet.</li>
          ) : (
            (events ?? []).map((e) => (
              <li key={e.id} className="py-3">
                <Link
                  href={`/events/${e.id}`}
                  className="flex justify-between gap-3 hover:text-accent"
                >
                  <span className="min-w-0 break-words font-medium">
                    {e.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted">{e.status}</span>
                </Link>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">People</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {(members ?? []).map((m) => (
            <li
              key={m.user_id}
              className="rounded-full border border-line px-3 py-1.5 text-xs"
            >
              {nameById.get(m.user_id)}
            </li>
          ))}
        </ul>

        {isCreator && trip.status === "open" && available.length > 0 ? (
          <form action={addMembersAction} className="mt-4 space-y-3">
            <div className="max-h-36 space-y-2 overflow-y-auto rounded-2xl border border-line p-3">
              {available.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="member_id" value={p.id} />
                  {p.display_name}
                </label>
              ))}
            </div>
            <button
              type="submit"
              className="rounded-xl border border-line px-4 py-2 text-sm hover:border-accent"
            >
              Add people
            </button>
          </form>
        ) : null}
      </section>

      {isCreator && trip.status === "open" ? (
        <form action={closeAction} className="mt-10">
          <button
            type="submit"
            className="text-sm text-muted underline-offset-2 hover:text-danger hover:underline"
          >
            Close this tab
          </button>
        </form>
      ) : null}
    </AppShell>
  );
}
