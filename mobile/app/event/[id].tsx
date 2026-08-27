import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";

import {
  ActionTile,
  BigButton,
  PageTitle,
  Screen,
  SectionLabel,
  Subtle,
} from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { eventKindLabel } from "@/lib/theme";
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
    <Screen
      bottomBar={
        <BigButton label="Back" mode="outlined" icon="arrow-left" onPress={() => router.back()} />
      }
    >
      {loading || !event ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" />
      ) : (
        <>
          <PageTitle>{event.title}</PageTitle>
          <Subtle>
            {eventKindLabel(event.kind)} · {event.status}
            {event.entry_fee_units != null
              ? ` · entry ${formatMoney(event.entry_fee_units)}`
              : ""}
          </Subtle>

          <SectionLabel>Players</SectionLabel>
          {players.map((p, i) => (
            <ActionTile
              key={`${p.display_name}-${i}`}
              title={p.display_name ?? "Player"}
              subtitle={
                p.units_delta != null
                  ? `${p.invite_status} · ${p.units_delta > 0 ? "+" : ""}${formatMoney(p.units_delta)}`
                  : p.invite_status
              }
            />
          ))}
          <Subtle>Settle scores on the web for now — mobile settle next.</Subtle>
        </>
      )}
    </Screen>
  );
}
