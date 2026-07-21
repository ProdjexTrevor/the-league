import Link from "next/link";
import { redirect } from "next/navigation";

import { createLeague, joinLeague, signOut } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

export default async function AppPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const { data: memberships } = await supabase
    .from("league_members")
    .select("role, leagues(id, name, description, invite_code)")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false });

  const leagues =
    memberships
      ?.map((m) => {
        const league = Array.isArray(m.leagues) ? m.leagues[0] : m.leagues;
        if (!league) return null;
        return { ...league, role: m.role };
      })
      .filter(Boolean) ?? [];

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link href="/" className="font-display text-2xl text-fg">
            THE LEAGUE
          </Link>
          <p className="mt-2 text-sm text-muted">
            Hey {profile?.display_name ?? "player"} — your leagues
          </p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-muted transition hover:text-fg"
          >
            Sign out
          </button>
        </form>
      </header>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Your leagues</h2>
        {leagues.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No leagues yet. Create one or join with an invite code.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {leagues.map((league) =>
              league ? (
                <li key={league.id}>
                  <Link
                    href={`/leagues/${league.id}`}
                    className="flex items-center justify-between gap-4 py-4 transition hover:bg-fg/[0.03]"
                  >
                    <div>
                      <p className="font-medium">{league.name}</p>
                      {league.description && (
                        <p className="mt-0.5 text-sm text-muted">
                          {league.description}
                        </p>
                      )}
                    </div>
                    <span className="text-xs uppercase tracking-wider text-muted">
                      {league.role}
                    </span>
                  </Link>
                </li>
              ) : null
            )}
          </ul>
        )}
      </section>

      <section className="mt-14 grid gap-10 md:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold">Create a league</h2>
          <form action={createLeague} className="mt-4 space-y-3">
            <input
              name="name"
              required
              placeholder="League name"
              className="w-full rounded-sm border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
            <textarea
              name="description"
              rows={2}
              placeholder="Optional description"
              className="w-full rounded-sm border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              className="rounded-sm bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink hover:brightness-110"
            >
              Create
            </button>
          </form>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Join with code</h2>
          <form action={joinLeague} className="mt-4 space-y-3">
            <input
              name="code"
              required
              placeholder="INVITE CODE"
              className="w-full rounded-sm border border-line bg-bg-elevated px-3 py-2.5 text-sm uppercase tracking-widest outline-none focus:border-accent"
            />
            <button
              type="submit"
              className="rounded-sm border border-line px-4 py-2.5 text-sm hover:border-fg/40"
            >
              Join league
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
