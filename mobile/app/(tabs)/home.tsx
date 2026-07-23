import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { BrandTitle, Card, Heading, Muted, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { colors, spacing } from "@/lib/theme";

type LeagueRow = {
  id: string;
  name: string;
  invite_code: string;
};

type EventRow = {
  id: string;
  title: string;
  status: string;
  kind: string;
  starts_at: string | null;
};

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [leagues, setLeagues] = useState<LeagueRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [displayName, setDisplayName] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [{ data: profile }, { data: memberships }, { data: eventPlayers }] =
      await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
        supabase.from("league_members").select("league_id, leagues(id, name, invite_code)").eq("user_id", user.id),
        supabase
          .from("event_players")
          .select("event_id, events(id, title, status, kind, starts_at)")
          .eq("user_id", user.id)
          .eq("invite_status", "accepted"),
      ]);

    setDisplayName(profile?.display_name ?? user.email ?? "Player");

    const leagueList = (memberships ?? [])
      .map((m: { leagues: LeagueRow | LeagueRow[] | null }) => {
        const l = Array.isArray(m.leagues) ? m.leagues[0] : m.leagues;
        return l;
      })
      .filter(Boolean) as LeagueRow[];
    setLeagues(leagueList);

    const eventList = (eventPlayers ?? [])
      .map((row: { events: EventRow | EventRow[] | null }) => {
        const e = Array.isArray(row.events) ? row.events[0] : row.events;
        return e;
      })
      .filter(Boolean) as EventRow[];
    eventList.sort((a, b) => {
      const at = a.starts_at ? new Date(a.starts_at).getTime() : 0;
      const bt = b.starts_at ? new Date(b.starts_at).getTime() : 0;
      return bt - at;
    });
    setEvents(eventList.slice(0, 12));
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <Screen style={{ paddingTop: spacing.xl + 8 }}>
      <ScrollView>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <BrandTitle />
          <Pressable onPress={() => void signOut()}>
            <Text style={{ color: colors.muted, fontFamily: "DMSans_400Regular" }}>Sign out</Text>
          </Pressable>
        </View>
        <Muted>Hey {displayName}. Your crew’s on the board.</Muted>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />
        ) : (
          <>
            <Heading>Leagues</Heading>
            {leagues.length === 0 ? (
              <Muted>No leagues yet — create one or join with a code.</Muted>
            ) : (
              leagues.map((league) => (
                <Card key={league.id} onPress={() => router.push(`/league/${league.id}`)}>
                  <Text style={{ color: colors.fg, fontFamily: "DMSans_700Bold", fontSize: 16 }}>
                    {league.name}
                  </Text>
                  <Text style={{ color: colors.muted, marginTop: 4, fontFamily: "DMSans_400Regular" }}>
                    Code {league.invite_code}
                  </Text>
                </Card>
              ))
            )}

            <Heading>Recent events</Heading>
            {events.length === 0 ? (
              <Muted>No games yet. Hit Create to start one.</Muted>
            ) : (
              events.map((event) => (
                <Card key={event.id} onPress={() => router.push(`/event/${event.id}`)}>
                  <Text style={{ color: colors.fg, fontFamily: "DMSans_700Bold", fontSize: 16 }}>
                    {event.title}
                  </Text>
                  <Text style={{ color: colors.muted, marginTop: 4, fontFamily: "DMSans_400Regular" }}>
                    {event.kind} · {event.status}
                  </Text>
                </Card>
              ))
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
