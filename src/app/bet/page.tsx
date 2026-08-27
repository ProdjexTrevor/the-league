import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { QuickBetForm } from "@/components/quick-bet-form";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ against?: string }>;
};

export default async function BetPage({ searchParams }: Props) {
  const { against } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/bet");

  const [{ data: memberships }, { data: propCatalog }, { data: allProfiles }] =
    await Promise.all([
      supabase
        .from("league_members")
        .select("leagues(id)")
        .eq("user_id", user.id),
      supabase
        .from("game_catalog")
        .select("id")
        .eq("slug", "proposition")
        .maybeSingle(),
      supabase.from("profiles").select("id, display_name").order("display_name"),
    ]);

  const leagueIds =
    memberships
      ?.map((m) => {
        const league = Array.isArray(m.leagues) ? m.leagues[0] : m.leagues;
        return league?.id as string | undefined;
      })
      .filter(Boolean) ?? [];

  const { data: roster } =
    leagueIds.length > 0
      ? await supabase
          .from("league_members")
          .select("user_id, profiles(id, display_name)")
          .in("league_id", leagueIds as string[])
      : { data: [] };

  const opponentMap = new Map<
    string,
    { id: string; display_name: string | null }
  >();
  for (const row of roster ?? []) {
    if (row.user_id === user.id) continue;
    const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    if (p?.id) opponentMap.set(p.id, p);
  }
  for (const p of allProfiles ?? []) {
    if (p.id === user.id) continue;
    if (!opponentMap.has(p.id)) {
      opponentMap.set(p.id, { id: p.id, display_name: p.display_name });
    }
  }
  const opponents = Array.from(opponentMap.values()).sort((a, b) =>
    (a.display_name ?? "").localeCompare(b.display_name ?? "")
  );

  const catalogId = propCatalog?.id ?? "";

  return (
    <AppShell userId={user.id}>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
        No bookies · just friends
      </p>
      <h1 className="font-display text-4xl tracking-[0.04em] text-fg sm:text-5xl">
        SET THE{" "}
        <span className="text-accent">LINE</span>
      </h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        Set the bet, set the line, shake on it. We keep the receipt.
      </p>

      <div className="mt-6">
        {catalogId ? (
          <QuickBetForm
            catalogId={catalogId}
            opponents={opponents}
            showHeading
            defaultAgainstId={against ?? ""}
            currentUserId={user.id}
          />
        ) : (
          <p className="text-sm text-muted">
            Catalog isn’t ready. Use the{" "}
            <Link href="/create" className="text-accent hover:underline">
              full create flow
            </Link>
            .
          </p>
        )}
      </div>

      <p className="mt-8 text-center text-xs text-muted">
        Leagues or tournaments?{" "}
        <Link href="/create" className="text-accent hover:underline">
          Full create
        </Link>
      </p>
    </AppShell>
  );
}
