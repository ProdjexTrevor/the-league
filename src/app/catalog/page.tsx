import Link from "next/link";
import { redirect } from "next/navigation";

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

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-10">
      <Link href="/app" className="text-sm text-muted hover:text-fg">
        ← Dashboard
      </Link>
      <h1 className="mt-6 font-display text-5xl text-fg">Game catalog</h1>
      <p className="mt-3 text-sm text-muted">
        System games available when you create a game or tournament. More games
        will be added as you feed them in.
      </p>

      {!games?.length ? (
        <p className="mt-8 text-sm text-danger">
          Catalog empty — run{" "}
          <code className="text-accent">20260721_competitions_catalog_odds.sql</code>{" "}
          in Supabase.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {games.map((g) => (
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
    </main>
  );
}
