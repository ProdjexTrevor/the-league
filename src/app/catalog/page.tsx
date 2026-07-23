import Link from "next/link";
import { redirect } from "next/navigation";

import { createCustomGame } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { scoringModeLabel, type ScoringMode } from "@/lib/wager";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: games } = await supabase
    .from("game_catalog")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  const systemGames = games?.filter((g) => g.is_system !== false) ?? [];
  const customGames = games?.filter((g) => g.is_system === false) ?? [];

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-8 pb-20 sm:px-6 sm:py-10">
      <Link href="/app" className="text-sm text-muted hover:text-fg">
        ← Dashboard
      </Link>
      <h1 className="mt-6 font-display text-4xl text-fg sm:text-5xl">
        Game catalog
      </h1>
      <p className="mt-3 text-sm text-muted">
        Yard, BBQ, and card games for wagers — or define your own.
      </p>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Define your own game</h2>
        <form action={createCustomGame} className="mt-4 space-y-3">
          <input
            name="name"
            required
            placeholder="Game name"
            className="w-full rounded-sm border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
          <textarea
            name="description"
            rows={2}
            placeholder="How you play / house rules (optional)"
            className="w-full rounded-sm border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
          <select
            name="scoring_mode"
            defaultValue="custom"
            className="w-full rounded-sm border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent"
          >
            <option value="higher_wins">Higher score wins</option>
            <option value="lower_wins">Lower score wins</option>
            <option value="placement">Placement (1 = winner)</option>
            <option value="head_to_head">Head to head (W/L/D)</option>
            <option value="custom">Custom / freeform</option>
          </select>
          <button
            type="submit"
            className="rounded-sm bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink hover:brightness-110"
          >
            Add to catalog
          </button>
        </form>
      </section>

      {customGames.length > 0 && (
        <section className="mt-14">
          <h2 className="text-lg font-semibold">Custom games</h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {customGames.map((g) => (
              <li key={g.id} className="py-4">
                <p className="font-medium">{g.name}</p>
                <p className="mt-1 text-sm text-muted">
                  {scoringModeLabel(g.scoring_mode as ScoringMode)}
                  {g.description ? ` · ${g.description}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-14">
        <h2 className="text-lg font-semibold">System games</h2>
        {!systemGames.length ? (
          <p className="mt-3 text-sm text-danger">
            Catalog empty — run{" "}
            <code className="text-accent">20260722_catalog_bbq_games.sql</code>{" "}
            in Supabase.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {systemGames.map((g) => (
              <li key={g.id} className="py-4">
                <p className="font-medium">{g.name}</p>
                <p className="mt-1 text-sm text-muted">
                  {scoringModeLabel(g.scoring_mode as ScoringMode)}
                  {g.description ? ` · ${g.description}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
