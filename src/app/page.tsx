import Link from "next/link";

import { Brand, BrandPill } from "@/components/brand";
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
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 pb-16 pt-6 sm:px-5 sm:pt-8">
      <header className="flex items-center justify-between gap-3">
        <Brand href="/" size="sm" />
        <nav className="flex items-center gap-2">
          {user ? (
            <Link
              href="/app"
              className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:brightness-110"
            >
              Open book
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
                className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:brightness-110"
              >
                Join
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="flex flex-1 flex-col justify-center py-16">
        <div className="animate-rise">
          <BrandPill>No bookies · just friends</BrandPill>
        </div>
        <h1 className="animate-rise-delay mt-5">
          <Brand href={null} size="hero" />
        </h1>
        <p className="animate-rise-delay mt-5 max-w-sm text-base leading-relaxed text-muted sm:text-lg">
          Set the bet, set the line, shake on it. We keep the receipts so nobody
          “forgets” who paid.
        </p>
        <div className="animate-rise-delay-2 mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href={user ? "/app" : "/signup"}
            className="inline-flex items-center justify-center rounded-xl bg-accent px-6 py-3.5 text-sm font-semibold text-accent-ink transition hover:brightness-110"
          >
            {user ? "Open your book" : "Start betting"}
          </Link>
          {!user ? (
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl border border-line px-6 py-3.5 text-sm text-fg transition hover:border-fg/35"
            >
              I have an account
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}
