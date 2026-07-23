import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text } from "react-native";

import {
  ListRow,
  ListSection,
  Muted,
  Screen,
  SectionTitle,
} from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { colors, spacing } from "@/lib/theme";

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
    <Screen>
      <Pressable onPress={() => router.back()}>
        <Text style={{ color: colors.muted, fontFamily: "DMSans_400Regular", fontSize: 14 }}>
          ← Back
        </Text>
      </Pressable>
      {loading || !league ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text
            style={{
              fontFamily: "DMSans_700Bold",
              fontSize: 22,
              color: colors.fg,
              marginTop: 24,
            }}
          >
            {league.name}
          </Text>
          <Muted>Invite code {league.invite_code}</Muted>
          {league.description ? <Muted>{league.description}</Muted> : null}

          <SectionTitle>Members</SectionTitle>
          <ListSection>
            {members.map((m, i) => (
              <ListRow
                key={`${m.display_name}-${i}`}
                title={m.display_name ?? "Player"}
                isFirst={i === 0}
                isLast={i === members.length - 1}
              />
            ))}
          </ListSection>

          <SectionTitle>Events</SectionTitle>
          {events.length === 0 ? (
            <Muted>No events in this league yet.</Muted>
          ) : (
            <ListSection>
              {events.map((e, i) => (
                <ListRow
                  key={e.id}
                  title={e.title}
                  subtitle={`${e.kind} · ${e.status}`}
                  onPress={() => router.push(`/event/${e.id}`)}
                  isFirst={i === 0}
                  isLast={i === events.length - 1}
                />
              ))}
            </ListSection>
          )}
          <ViewSpacer />
        </ScrollView>
      )}
    </Screen>
  );
}

function ViewSpacer() {
  return <Text style={{ height: spacing.xl }}> </Text>;
}
