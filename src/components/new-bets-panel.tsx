import Link from "next/link";

import { AcceptInviteButton } from "@/components/accept-invite-button";
import { eventKindLabel } from "@/lib/wager";

export type NewBetInvite = {
  id: string;
  title: string;
  kind: string;
  notes?: string | null;
  default_stake_units?: number | string | null;
  entry_fee_units?: number | string | null;
  created_at: string;
  creatorName: string;
  myStake: number;
};

function stakeLabel(amount: number) {
  if (!(amount > 0)) return null;
  const formatted = amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2);
  return `$${formatted}`;
}

export function NewBetsPanel({ bets }: { bets: NewBetInvite[] }) {
  if (bets.length === 0) return null;

  return (
    <section className="animate-rise-delay mt-5 rounded-2xl border border-accent/40 bg-accent/10 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">New bets</h2>
        <span className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-accent-ink">
          {bets.length}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">
        Someone locked you in — accept to make it official.
      </p>
      <ul className="mt-3 space-y-2">
        {bets.map((bet) => {
          const stake =
            bet.myStake > 0
              ? bet.myStake
              : Number(bet.default_stake_units ?? bet.entry_fee_units ?? 0);
          return (
            <li
              key={bet.id}
              className="rounded-2xl border border-accent/25 bg-bg/60 px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wider text-muted">
                    {eventKindLabel(bet.kind)} · from {bet.creatorName}
                  </p>
                  <p className="mt-0.5 truncate font-medium">{bet.title}</p>
                  {stakeLabel(stake) ? (
                    <p className="mt-0.5 text-xs text-muted">
                      Your stake: {stakeLabel(stake)}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <AcceptInviteButton
                  eventId={bet.id}
                  label="Accept"
                  className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-accent-ink hover:brightness-110 disabled:opacity-60"
                />
                <Link
                  href={`/events/${bet.id}`}
                  className="rounded-xl border border-line px-3 py-2.5 text-xs font-semibold text-muted hover:text-fg"
                >
                  Details
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
