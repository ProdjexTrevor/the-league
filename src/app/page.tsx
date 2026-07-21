import Link from "next/link";

import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  let user: { id: string } | null = null;

  if (getSupabaseEnv()) {
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      user = data.user;
    } catch {
      user = null;
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden">
      <div className="hero-grain pointer-events-none absolute inset-0" aria-hidden />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10">
        <p className="font-display text-2xl text-fg md:text-3xl">THE LEAGUE</p>
        <nav className="flex items-center gap-3">
          {user ? (
            <Link
              href="/app"
              className="rounded-sm bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:brightness-110"
            >
              Open app
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="px-3 py-2 text-sm text-muted transition hover:text-fg"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-sm bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:brightness-110"
              >
                Start a league
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="relative z-10 flex flex-1 flex-col justify-center px-6 pb-24 pt-10 md:px-10 md:pb-32">
        <div className="max-w-3xl">
          <h1 className="font-display animate-rise text-[clamp(4.5rem,14vw,9rem)] leading-[0.9] text-fg">
            THE LEAGUE
          </h1>
          <p className="animate-rise-delay mt-6 max-w-md text-lg text-muted md:text-xl">
            Track friendly wagers, settle scores, and keep the standings honest —
            poker night to March Madness.
          </p>
          <div className="animate-rise-delay-2 mt-10 flex flex-wrap gap-4">
            <Link
              href={user ? "/app" : "/signup"}
              className="rounded-sm bg-accent px-6 py-3 text-sm font-semibold tracking-wide text-accent-ink transition hover:brightness-110"
            >
              {user ? "Go to dashboard" : "Create your league"}
            </Link>
            {!user && (
              <Link
                href="/login"
                className="rounded-sm border border-line px-6 py-3 text-sm text-fg transition hover:border-fg/40"
              >
                I have an invite
              </Link>
            )}
          </div>
        </div>
      </section>

      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[linear-gradient(115deg,transparent_20%,rgba(214,255,75,0.05)_45%,rgba(20,40,30,0.4)_70%)] max-md:hidden"
        aria-hidden
      />
    </main>
  );
}
