import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text } from "react-native";

import { Card, Heading, Muted, Screen } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { colors, spacing } from "@/lib/theme";

export default function LeagueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [league, setLeague] = useState<{ name: string; invite_code: string } | null>(null);
  const [members, setMembers] = useState<{ display_name: string | null }[]>([]);
  const [events, setEvents] = useState<{ id: string; title: string; status: string }[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: leagueRow }, { data: memberRows }, { data: eventRows }] = await Promise.all([
      supabase.from("leagues").select("name, invite_code").eq("id", id).maybeSingle(),
      supabase
        .from("league_members")
        .select("profiles(display_name)")
        .eq("league_id", id),
      supabase
        .from("events")
        .select("id, title, status")
        .eq("league_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    setLeague(leagueRow);
    setMembers(
      (memberRows ?? []).map((m: { profiles: { display_name: string | null } | { display_name: string | null }[] | null }) => {
        const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
        return { display_name: p?.display_name ?? null };
      })
    );
    setEvents(eventRows ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen style={{ paddingTop: spacing.xl }}>
      <Pressable onPress={() => router.back()}>
        <Text style={{ color: colors.accent, fontFamily: "DMSans_700Bold" }}>← Back</Text>
      </Pressable>
      {loading || !league ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />
      ) : (
        <ScrollView>
          <Heading>{league.name}</Heading>
          <Muted>Invite code {league.invite_code}</Muted>

          <Heading>Members</Heading>
          {members.map((m, i) => (
            <Card key={`${m.display_name}-${i}`}>
              <Text style={{ color: colors.fg, fontFamily: "DMSans_400Regular" }}>
                {m.display_name ?? "Player"}
              </Text>
            </Card>
          ))}

          <Heading>Events</Heading>
          {events.length === 0 ? (
            <Muted>No events in this league yet.</Muted>
          ) : (
            events.map((e) => (
              <Card key={e.id} onPress={() => router.push(`/event/${e.id}`)}>
                <Text style={{ color: colors.fg, fontFamily: "DMSans_700Bold" }}>{e.title}</Text>
                <Text style={{ color: colors.muted, marginTop: 4 }}>{e.status}</Text>
              </Card>
            ))
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
