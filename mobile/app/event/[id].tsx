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
import { colors, eventKindLabel, spacing } from "@/lib/theme";
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
          profiles:
            | { display_name: string | null }
            | { display_name: string | null }[]
            | null;
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
    <Screen>
      <Pressable onPress={() => router.back()}>
        <Text style={{ color: colors.muted, fontFamily: "DMSans_400Regular", fontSize: 14 }}>
          ← Back
        </Text>
      </Pressable>
      {loading || !event ? (
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
            {event.title}
          </Text>
          <Muted>
            {eventKindLabel(event.kind)} · {event.status}
            {event.entry_fee_units != null
              ? ` · entry ${formatMoney(event.entry_fee_units)}`
              : ""}
            {event.wager_mode ? ` · ${event.wager_mode}` : ""}
          </Muted>

          <SectionTitle>Players</SectionTitle>
          <ListSection>
            {players.map((p, i) => (
              <ListRow
                key={`${p.display_name}-${i}`}
                title={p.display_name ?? "Player"}
                subtitle={
                  p.units_delta != null
                    ? `${p.invite_status} · ${p.units_delta > 0 ? "+" : ""}${formatMoney(p.units_delta)}`
                    : p.invite_status
                }
                isFirst={i === 0}
                isLast={i === players.length - 1}
              />
            ))}
          </ListSection>
          <Muted>
            Settle scores on the web app for now — full mobile settle comes next.
          </Muted>
          <Text style={{ height: spacing.xl }}> </Text>
        </ScrollView>
      )}
    </Screen>
  );
}
