import Link from "next/link";
import { redirect } from "next/navigation";

import { CreateWizard } from "@/components/create-wizard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ league?: string; kind?: string }>;
};

export default async function CreatePage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/create`);

  const [{ data: memberships }, { data: catalog }, { data: profiles }] =
    await Promise.all([
      supabase
        .from("league_members")
        .select("league_id, user_id, leagues(id, name)")
        .eq("user_id", user.id),
      supabase
        .from("game_catalog")
        .select("id, name, scoring_mode, description")
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("profiles")
        .select("id, display_name")
        .order("display_name"),
    ]);

  const leagues =
    memberships
      ?.map((m) => {
        const league = Array.isArray(m.leagues) ? m.leagues[0] : m.leagues;
        return league ? { id: league.id, name: league.name } : null;
      })
      .filter(Boolean) ?? [];

  // All members for leagues the user belongs to (for player picker)
  const leagueIds = leagues.map((l) => l!.id);
  const leagueMemberIds: Record<string, string[]> = {};
  if (leagueIds.length > 0) {
    const { data: allMembers } = await supabase
      .from("league_members")
      .select("league_id, user_id")
      .in("league_id", leagueIds);
    for (const row of allMembers ?? []) {
      if (!leagueMemberIds[row.league_id]) leagueMemberIds[row.league_id] = [];
      leagueMemberIds[row.league_id].push(row.user_id);
    }
  }

  // If opening from a specific league, ensure we have that roster even if query filtered oddly
  if (params.league && !leagueMemberIds[params.league]) {
    const { data: roster } = await supabase
      .from("league_members")
      .select("user_id")
      .eq("league_id", params.league);
    leagueMemberIds[params.league] = (roster ?? []).map((r) => r.user_id);
  }

  const lockedLeagueId = params.league || undefined;
  const initialKind =
    params.kind === "game" ||
    params.kind === "tournament" ||
    params.kind === "league"
      ? (params.kind as "game" | "tournament" | "league")
      : undefined;

  const cancelHref = lockedLeagueId ? `/leagues/${lockedLeagueId}` : "/app";

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-10">
      <Link href={cancelHref} className="font-display text-2xl text-fg">
        THE LEAGUE
      </Link>
      <div className="mt-12">
        <CreateWizard
          catalog={catalog ?? []}
          leagues={leagues as { id: string; name: string }[]}
          users={(profiles ?? []).map((p) => ({
            id: p.id,
            display_name: p.display_name,
          }))}
          leagueMemberIds={leagueMemberIds}
          currentUserId={user.id}
          lockedLeagueId={lockedLeagueId}
          initialIntent={initialKind}
          onCancelHref={cancelHref}
        />
      </div>
    </main>
  );
}
