import Link from "next/link";

import { Brand } from "@/components/brand";
import { signOut } from "@/app/actions";

export function AppShell({
  children,
  userId,
}: {
  children: React.ReactNode;
  userId?: string;
}) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-lg px-4 pb-24 pt-6 sm:px-5 sm:pt-8">
      <header className="flex items-center justify-between gap-3">
        <Brand href="/app" size="sm" />
        <nav className="flex items-center gap-3 text-sm text-muted">
          {userId ? (
            <Link href={`/players/${userId}`} className="hover:text-fg">
              Stats
            </Link>
          ) : null}
          <Link href="/wallet" className="hover:text-fg">
            Wallet
          </Link>
          <form action={signOut}>
            <button type="submit" className="hover:text-fg">
              Out
            </button>
          </form>
        </nav>
      </header>
      {children}
    </main>
  );
}
