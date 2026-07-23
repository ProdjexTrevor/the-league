import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text } from "react-native";

import { Card, Heading, Muted, Screen } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { colors, spacing } from "@/lib/theme";
import { formatMoney } from "@/lib/venmo";

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<{
    title: string;
    status: string;
    kind: string;
    entry_fee_units: number | null;
    wager_mode: string | null;
  } | null>(null);
  const [players, setPlayers] = useState<
    { display_name: string | null; invite_status: string; units_delta: number | null }[]
  >([]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: eventRow }, { data: playerRows }] = await Promise.all([
      supabase
        .from("events")
        .select("title, status, kind, entry_fee_units, wager_mode")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("event_players")
        .select("invite_status, units_delta, profiles(display_name)")
        .eq("event_id", id),
    ]);
    setEvent(
      eventRow
        ? {
            ...eventRow,
            entry_fee_units:
              eventRow.entry_fee_units != null ? Number(eventRow.entry_fee_units) : null,
          }
        : null
    );
    setPlayers(
      (playerRows ?? []).map(
        (p: {
          invite_status: string;
          units_delta: number | null;
          profiles: { display_name: string | null } | { display_name: string | null }[] | null;
        }) => {
          const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
          return {
            display_name: profile?.display_name ?? null,
            invite_status: p.invite_status,
            units_delta: p.units_delta != null ? Number(p.units_delta) : null,
          };
        }
      )
    );
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
      {loading || !event ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />
      ) : (
        <ScrollView>
          <Heading>{event.title}</Heading>
          <Muted>
            {event.kind} · {event.status}
            {event.entry_fee_units != null
              ? ` · entry ${formatMoney(event.entry_fee_units)}`
              : ""}
            {event.wager_mode ? ` · ${event.wager_mode}` : ""}
          </Muted>

          <Heading>Players</Heading>
          {players.map((p, i) => (
            <Card key={`${p.display_name}-${i}`}>
              <Text style={{ color: colors.fg, fontFamily: "DMSans_700Bold" }}>
                {p.display_name ?? "Player"}
              </Text>
              <Text style={{ color: colors.muted, marginTop: 4, fontFamily: "DMSans_400Regular" }}>
                {p.invite_status}
                {p.units_delta != null ? ` · ${p.units_delta > 0 ? "+" : ""}${p.units_delta}` : ""}
              </Text>
            </Card>
          ))}
          <Muted>
            Settle scores and manage invites on the web app for now — mobile settle comes next.
          </Muted>
        </ScrollView>
      )}
    </Screen>
  );
}
