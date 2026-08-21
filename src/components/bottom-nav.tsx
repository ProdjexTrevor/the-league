"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = { userId: string };

function IconHome({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.7}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconWallet({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 7.5A2.5 2.5 0 0 1 5.5 5H19a1 1 0 0 1 1 1v2.5M3 7.5V18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7H9.5A2.5 2.5 0 0 0 7 13.5v0A2.5 2.5 0 0 0 9.5 16H21"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="17.5" cy="13.5" r="1" fill="currentColor" />
    </svg>
  );
}

function IconBet() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconStats({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 19V11M12 19V5M19 19v-7"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.7}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BottomNav({ userId }: Props) {
  const pathname = usePathname();

  const home = pathname === "/app" || pathname.startsWith("/app/");
  const wallet = pathname.startsWith("/wallet");
  const bet =
    pathname.startsWith("/bet") || pathname.startsWith("/create");
  const stats = pathname.startsWith("/players");

  const tab = (active: boolean) =>
    active ? "text-accent" : "text-muted active:text-fg";

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-bg/95 backdrop-blur-md"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}
      aria-label="Main"
    >
      <div className="mx-auto grid max-w-lg grid-cols-4 items-end px-1 pt-1">
        <Link
          href="/app"
          className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide ${tab(home)}`}
        >
          <IconHome active={home} />
          Home
        </Link>

        <Link
          href="/wallet"
          className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide ${tab(wallet)}`}
        >
          <IconWallet active={wallet} />
          Wallet
        </Link>

        <Link
          href="/bet"
          className="relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-ink"
        >
          <span className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent shadow-[0_8px_24px_rgba(200,245,74,0.35)]">
            <IconBet />
          </span>
          <span className="text-accent">Bet</span>
        </Link>

        <Link
          href={`/players/${userId}`}
          className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide ${tab(stats)}`}
        >
          <IconStats active={stats} />
          Stats
        </Link>
      </div>
    </nav>
  );
}
