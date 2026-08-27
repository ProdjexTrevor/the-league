import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";

import {
  ActionTile,
  BigButton,
  EmptyState,
  PageTitle,
  Screen,
  SectionLabel,
  Subtle,
} from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { eventKindLabel } from "@/lib/theme";

export default function LeagueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [league, setLeague] = useState<{
    name: string;
    invite_code: string;
    description: string | null;
  } | null>(null);
  const [members, setMembers] = useState<{ display_name: string | null }[]>([]);
  const [events, setEvents] = useState<{ id: string; title: string; status: string; kind: string }[]>(
    []
  );

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: leagueRow }, { data: memberRows }, { data: eventRows }] = await Promise.all([
      supabase
        .from("leagues")
        .select("name, invite_code, description")
        .eq("id", id)
        .maybeSingle(),
      supabase.from("league_members").select("profiles(display_name)").eq("league_id", id),
      supabase
        .from("events")
        .select("id, title, status, kind")
        .eq("league_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    setLeague(leagueRow);
    setMembers(
      (memberRows ?? []).map(
        (m: {
          profiles:
            | { display_name: string | null }
            | { display_name: string | null }[]
            | null;
        }) => {
          const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
          return { display_name: p?.display_name ?? null };
        }
      )
    );
    setEvents(eventRows ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen
      bottomBar={
        <BigButton label="Back" mode="outlined" icon="arrow-left" onPress={() => router.back()} />
      }
    >
      {loading || !league ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" />
      ) : (
        <>
          <PageTitle>{league.name}</PageTitle>
          <Subtle>Invite code {league.invite_code}</Subtle>
          {league.description ? <Subtle>{league.description}</Subtle> : null}

          <SectionLabel>Members</SectionLabel>
          {members.map((m, i) => (
            <ActionTile key={`${m.display_name}-${i}`} title={m.display_name ?? "Player"} />
          ))}

          <SectionLabel>Events</SectionLabel>
          {events.length === 0 ? (
            <EmptyState message="No events in this league yet." />
          ) : (
            events.map((e) => (
              <ActionTile
                key={e.id}
                title={e.title}
                subtitle={`${eventKindLabel(e.kind)} · ${e.status}`}
                onPress={() => router.push(`/event/${e.id}`)}
              />
            ))
          )}
        </>
      )}
    </Screen>
  );
}
