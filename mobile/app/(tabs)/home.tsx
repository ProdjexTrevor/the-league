import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import {
  BrandTitle,
  ListRow,
  ListSection,
  Muted,
  PrimaryButton,
  Screen,
  SecondaryButton,
  SectionTitle,
} from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { colors, eventKindLabel, spacing } from "@/lib/theme";

type LeagueRow = {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  role?: string;
};

type EventRow = {
  id: string;
  title: string;
  status: string;
  kind: string;
  created_at: string;
  entry_fee_units?: number | null;
  wager_mode?: string | null;
};

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [leagues, setLeagues] = useState<LeagueRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [pending, setPending] = useState<EventRow[]>([]);
  const [displayName, setDisplayName] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [{ data: profile }, { data: memberships }, { data: myEvents }, { data: playing }] =
      await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
        supabase
          .from("league_members")
          .select("role, leagues(id, name, description, invite_code)")
          .eq("user_id", user.id)
          .order("joined_at", { ascending: false }),
        supabase
          .from("events")
          .select("id, title, kind, status, entry_fee_units, wager_mode, created_at")
          .eq("created_by", user.id)
          .order("created_at", { ascending: false })
          .limit(40),
        supabase
          .from("event_players")
          .select(
            "invite_status, events(id, title, kind, status, entry_fee_units, wager_mode, created_at)"
          )
          .eq("user_id", user.id)
          .limit(50),
      ]);

    setDisplayName(profile?.display_name ?? "player");

    const leagueList = (memberships ?? [])
      .map((m: { role: string; leagues: LeagueRow | LeagueRow[] | null }) => {
        const l = Array.isArray(m.leagues) ? m.leagues[0] : m.leagues;
        if (!l) return null;
        return { ...l, role: m.role };
      })
      .filter(Boolean) as LeagueRow[];
    setLeagues(leagueList);

    const eventMap = new Map<string, EventRow>();
    (myEvents ?? []).forEach((e) => eventMap.set(e.id, e as EventRow));
    const pendingList: EventRow[] = [];
    (playing ?? []).forEach(
      (row: {
        invite_status: string;
        events: EventRow | EventRow[] | null;
      }) => {
        const e = Array.isArray(row.events) ? row.events[0] : row.events;
        if (!e) return;
        if (row.invite_status === "pending") pendingList.push(e);
        eventMap.set(e.id, e);
      }
    );
    setPending(pendingList);
    setEvents(
      Array.from(eventMap.values()).sort(
        (a, b) => +new Date(b.created_at) - +new Date(a.created_at)
      )
    );
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <BrandTitle size="md" />
            <Muted>Hey {displayName}</Muted>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, justifyContent: "flex-end" }}>
            <Pressable onPress={() => router.push("/(tabs)/wallet")}>
              <Text style={navLink}>Wallet</Text>
            </Pressable>
            <Pressable onPress={() => void signOut()}>
              <Text style={navLink}>Sign out</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 40 }}>
          <PrimaryButton
            label="Start something"
            onPress={() => router.push("/(tabs)/create")}
            style={{ marginTop: 0 }}
          />
          <SecondaryButton
            label="Make a bet"
            onPress={() => router.push("/(tabs)/create")}
          />
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 48 }} />
        ) : (
          <>
            {pending.length > 0 ? (
              <>
                <SectionTitle>Invites waiting</SectionTitle>
                <ListSection>
                  {pending.map((event, i) => (
                    <ListRow
                      key={event.id}
                      title={event.title}
                      subtitle={`${eventKindLabel(event.kind)} · accept to join`}
                      meta="Pending"
                      metaAccent
                      onPress={() => router.push(`/event/${event.id}`)}
                      isFirst={i === 0}
                      isLast={i === pending.length - 1}
                    />
                  ))}
                </ListSection>
              </>
            ) : null}

            <SectionTitle>Your events</SectionTitle>
            {events.length === 0 ? (
              <Muted>
                No games, bets, or tournaments yet.{" "}
                <Text
                  style={{ color: colors.accent }}
                  onPress={() => router.push("/(tabs)/create")}
                >
                  Start one
                </Text>
              </Muted>
            ) : (
              <ListSection>
                {events.slice(0, 20).map((event, i) => (
                  <ListRow
                    key={event.id}
                    title={event.title}
                    subtitle={`${eventKindLabel(event.kind)} · ${event.status}`}
                    onPress={() => router.push(`/event/${event.id}`)}
                    isFirst={i === 0}
                    isLast={i === Math.min(events.length, 20) - 1}
                  />
                ))}
              </ListSection>
            )}

            <SectionTitle>Your leagues</SectionTitle>
            {leagues.length === 0 ? (
              <Muted>
                No leagues yet.{" "}
                <Text
                  style={{ color: colors.accent }}
                  onPress={() => router.push("/(tabs)/create")}
                >
                  Create or join
                </Text>
                .
              </Muted>
            ) : (
              <ListSection>
                {leagues.map((league, i) => (
                  <ListRow
                    key={league.id}
                    title={league.name}
                    subtitle={league.description ?? undefined}
                    meta={league.role}
                    onPress={() => router.push(`/league/${league.id}`)}
                    isFirst={i === 0}
                    isLast={i === leagues.length - 1}
                  />
                ))}
              </ListSection>
            )}
            <View style={{ height: spacing.xl }} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const navLink = {
  fontFamily: "DMSans_400Regular" as const,
  fontSize: 14,
  color: colors.muted,
};
