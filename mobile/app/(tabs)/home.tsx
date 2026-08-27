import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { IconButton, Text } from "react-native-paper";

import {
  ActionTile,
  BigButton,
  BrandMark,
  EmptyState,
  Screen,
  SectionLabel,
  Subtle,
} from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { colors, eventKindLabel } from "@/lib/theme";

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
          .select("id, title, kind, status, created_at")
          .eq("created_by", user.id)
          .order("created_at", { ascending: false })
          .limit(40),
        supabase
          .from("event_players")
          .select("invite_status, events(id, title, kind, status, created_at)")
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
      (row: { invite_status: string; events: EventRow | EventRow[] | null }) => {
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
    <Screen
      bottomBar={
        <View style={{ gap: 10 }}>
          <BigButton
            label="Start something"
            icon="plus"
            onPress={() => router.push("/(tabs)/create")}
          />
          <BigButton
            label="Wallet"
            mode="outlined"
            icon="wallet"
            onPress={() => router.push("/(tabs)/wallet")}
          />
        </View>
      }
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <BrandMark compact />
        <IconButton
          icon="logout"
          iconColor={colors.muted}
          size={22}
          onPress={() => void signOut()}
          accessibilityLabel="Sign out"
        />
      </View>
      <Text variant="titleMedium" style={{ color: colors.fg, marginTop: 8, fontFamily: "DMSans_700Bold" }}>
        Hey {displayName}
      </Text>
      <Subtle>Tap a tile or use the big buttons below.</Subtle>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} size="large" />
      ) : (
        <>
          {pending.length > 0 ? (
            <>
              <SectionLabel>Invites</SectionLabel>
              {pending.map((event) => (
                <ActionTile
                  key={event.id}
                  title={event.title}
                  subtitle={`${eventKindLabel(event.kind)} · needs you`}
                  meta="Open"
                  onPress={() => router.push(`/event/${event.id}`)}
                />
              ))}
            </>
          ) : null}

          <SectionLabel>Your events</SectionLabel>
          {events.length === 0 ? (
            <EmptyState
              message="No games or bets yet."
              actionLabel="Create one"
              onAction={() => router.push("/(tabs)/create")}
            />
          ) : (
            events.slice(0, 12).map((event) => (
              <ActionTile
                key={event.id}
                title={event.title}
                subtitle={`${eventKindLabel(event.kind)} · ${event.status}`}
                onPress={() => router.push(`/event/${event.id}`)}
              />
            ))
          )}

          <SectionLabel>Your leagues</SectionLabel>
          {leagues.length === 0 ? (
            <EmptyState
              message="No leagues yet."
              actionLabel="Join or create"
              onAction={() => router.push("/(tabs)/create")}
            />
          ) : (
            leagues.map((league) => (
              <ActionTile
                key={league.id}
                title={league.name}
                subtitle={league.description ?? `Code ${league.invite_code}`}
                meta={league.role}
                onPress={() => router.push(`/league/${league.id}`)}
              />
            ))
          )}
        </>
      )}
    </Screen>
  );
}
