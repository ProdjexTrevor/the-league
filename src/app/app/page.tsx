import { AppShell } from "@/components/app-shell";
import { BrandPill } from "@/components/brand";
import { NewBetsPanel, type NewBetInvite } from "@/components/new-bets-panel";
import { TheBook } from "@/components/the-book";
import { getSupabase, requireUser } from "@/lib/auth";
import { venmoPayUrl } from "@/lib/venmo";

export const dynamic = "force-dynamic";

function money(n: number) {
  const abs = Math.abs(n);
  const formatted = abs % 1 === 0 ? abs.toFixed(0) : abs.toFixed(2);
  if (n > 0) return `+$${formatted}`;
  if (n < 0) return `-$${formatted}`;
  return `$${formatted}`;
}

type BookEvent = {
  id: string;
  title: string;
  kind: string;
  status: string;
  entry_fee_units: number;
  default_stake_units: number | null;
  wager_mode: string;
  notes: string | null;
  created_at: string;
  league_id: string | null;
  myInviteStatus?: string | null;
  waitingOnOthers?: boolean;
};

export default async function AppPage() {
  const user = await requireUser("/app");
  const supabase = await getSupabase();

  const eventSelect =
    "id, title, kind, status, entry_fee_units, default_stake_units, wager_mode, notes, created_at, league_id, created_by";

  // Single wave: profile + book + wallet + my participation (incl. pending)
  const [
    { data: profile },
    { data: myEvents },
    { data: owedRows },
    { data: dueRows },
    { data: playing },
  ] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
    supabase
      .from("events")
      .select(eventSelect)
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .limit(40),
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
    supabase
      .from("event_players")
      .select(`invite_status, event_id, events(${eventSelect})`)
      .eq("user_id", user.id)
      .limit(50),
  ]);

  const eventMap = new Map<string, BookEvent>();
  myEvents?.forEach((e) =>
    eventMap.set(e.id, { ...e, myInviteStatus: "accepted" })
  );

  const pendingFromPlaying: {
    event_id: string;
    event: BookEvent | null;
  }[] = [];

  playing?.forEach((row) => {
    const e = Array.isArray(row.events) ? row.events[0] : row.events;
    if (e) {
      eventMap.set(e.id, {
        ...e,
        myInviteStatus: row.invite_status,
      });
    }
    if (row.invite_status === "pending") {
      pendingFromPlaying.push({
        event_id: row.event_id,
        event: e
          ? { ...e, myInviteStatus: "pending" }
          : null,
      });
    }
  });

  // If nested events join failed for any pending rows, fetch those events directly
  const missingPendingIds = pendingFromPlaying
    .filter((p) => !p.event)
    .map((p) => p.event_id);
  const pendingEventsWithJoin = pendingFromPlaying
    .map((p) => p.event)
    .filter(Boolean) as BookEvent[];

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

  const openEventIds = [...eventMap.values()]
    .filter((e) => e.status === "open" || e.status === "in_progress")
    .map((e) => e.id);

  const personIds = [
    ...new Set([...owedByPerson.keys(), ...dueByPerson.keys()]),
  ];

  const creatorIdsFromJoin = [
    ...new Set(
      pendingEventsWithJoin
        .map((e) => (e as BookEvent & { created_by?: string }).created_by)
        .filter(Boolean) as string[]
    ),
  ];

  // Second wave: fill gaps + labels in parallel
  const [
    { data: missingPendingEvents },
    { data: pendingOthers },
    { data: people },
    { data: creatorsWave1 },
    { data: myStakesWave1 },
  ] = await Promise.all([
    missingPendingIds.length > 0
      ? supabase
          .from("events")
          .select(eventSelect)
          .in("id", missingPendingIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as BookEvent[] }),
    openEventIds.length > 0
      ? supabase
          .from("event_players")
          .select("event_id")
          .in("event_id", openEventIds)
          .eq("invite_status", "pending")
      : Promise.resolve({ data: [] as { event_id: string }[] }),
    personIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, display_name, venmo_username")
          .in("id", personIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string | null; venmo_username: string | null }[] }),
    creatorIdsFromJoin.length > 0
      ? supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", creatorIdsFromJoin)
      : Promise.resolve({ data: [] as { id: string; display_name: string | null }[] }),
    pendingFromPlaying.length > 0
      ? supabase
          .from("wager_lines")
          .select("event_id, stake_units")
          .in(
            "event_id",
            pendingFromPlaying.map((p) => p.event_id)
          )
          .eq("player_id", user.id)
      : Promise.resolve({ data: [] as { event_id: string; stake_units: number }[] }),
  ]);

  for (const event of missingPendingEvents ?? []) {
    eventMap.set(event.id, { ...event, myInviteStatus: "pending" });
    pendingEventsWithJoin.push({ ...event, myInviteStatus: "pending" });
  }

  const waitingIds = new Set(pendingOthers?.map((r) => r.event_id) ?? []);
  for (const id of waitingIds) {
    const existing = eventMap.get(id);
    if (existing && existing.myInviteStatus !== "pending") {
      eventMap.set(id, { ...existing, waitingOnOthers: true });
    }
  }

  const pendingEvents = [...eventMap.values()]
    .filter((e) => e.myInviteStatus === "pending")
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

  // Creators for any pending fetched in the missing-events path
  const allCreatorIds = [
    ...new Set(
      pendingEvents
        .map((e) => (e as BookEvent & { created_by?: string }).created_by)
        .filter(Boolean) as string[]
    ),
  ];
  const creatorById = new Map(
    creatorsWave1?.map((p) => [p.id, p.display_name]) ?? []
  );
  const missingCreatorIds = allCreatorIds.filter((id) => !creatorById.has(id));
  if (missingCreatorIds.length > 0) {
    const { data: moreCreators } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", missingCreatorIds);
    moreCreators?.forEach((p) => creatorById.set(p.id, p.display_name));
  }

  const myStakeByEvent = new Map(
    myStakesWave1?.map((line) => [line.event_id, Number(line.stake_units)]) ?? []
  );

  const newBets: NewBetInvite[] = pendingEvents.map((event) => ({
    id: event.id,
    title: event.title,
    kind: event.kind,
    notes: event.notes,
    default_stake_units: event.default_stake_units,
    entry_fee_units: event.entry_fee_units,
    created_at: event.created_at,
    creatorName:
      creatorById.get(
        (event as BookEvent & { created_by?: string }).created_by ?? ""
      ) ?? "Someone",
    myStake: myStakeByEvent.get(event.id) ?? 0,
  }));

  const events = Array.from(eventMap.values()).sort(
    (a, b) => +new Date(b.created_at) - +new Date(a.created_at)
  );

  const liveStake = events
    .filter((e) => e.status === "open" || e.status === "in_progress")
    .reduce(
      (s, e) => s + Number(e.default_stake_units ?? e.entry_fee_units ?? 0),
      0
    );

  const totalOwed = [...owedByPerson.values()].reduce((s, v) => s + v, 0);
  const totalDue = [...dueByPerson.values()].reduce((s, v) => s + v, 0);
  const net = totalDue - totalOwed;
  const personById = new Map(people?.map((p) => [p.id, p]) ?? []);

  return (
    <AppShell userId={user.id}>
      <div className="animate-rise">
        <BrandPill>No bookies · just friends</BrandPill>
        <p className="mt-3 text-sm text-muted">
          Hey {profile?.display_name ?? "player"}
        </p>
      </div>

      <NewBetsPanel bets={newBets} />

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
