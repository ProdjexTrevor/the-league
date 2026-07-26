import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  Field,
  ListRow,
  ListSection,
  Muted,
  PrimaryButton,
  Screen,
  SectionTitle,
} from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { colors, eventKindLabel, spacing } from "@/lib/theme";
import { formatMoney } from "@/lib/venmo";

type PlayerRow = {
  user_id: string;
  display_name: string | null;
  invite_status: string;
  units_delta: number | null;
};

type LineRow = {
  id: string;
  player_id: string | null;
  side_label: string | null;
  odds_num: number;
  odds_den: number;
  stake_units: number;
};

type ProfileOption = { id: string; display_name: string };

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [event, setEvent] = useState<{
    title: string;
    status: string;
    kind: string;
    entry_fee_units: number | null;
    wager_mode: string | null;
    default_stake_units: number | null;
  } | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [lines, setLines] = useState<LineRow[]>([]);
  const [inviteOptions, setInviteOptions] = useState<ProfileOption[]>([]);
  const [inviteUserId, setInviteUserId] = useState("");
  const [linePlayerId, setLinePlayerId] = useState("");
  const [oddsNum, setOddsNum] = useState("2");
  const [oddsDen, setOddsDen] = useState("1");
  const [stakeUnits, setStakeUnits] = useState("10");

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of players) {
      map.set(p.user_id, p.display_name ?? "Player");
    }
    return map;
  }, [players]);

  const acceptedPlayers = useMemo(
    () => players.filter((p) => (p.invite_status ?? "accepted") === "accepted"),
    [players]
  );

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: eventRow }, { data: playerRows }, { data: lineRows }, { data: profiles }] =
      await Promise.all([
        supabase
          .from("events")
          .select(
            "title, status, kind, entry_fee_units, wager_mode, default_stake_units"
          )
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("event_players")
          .select("user_id, invite_status, units_delta, profiles(display_name)")
          .eq("event_id", id),
        supabase
          .from("wager_lines")
          .select("id, player_id, side_label, odds_num, odds_den, stake_units")
          .eq("event_id", id),
        supabase.from("profiles").select("id, display_name").order("display_name"),
      ]);

    setEvent(
      eventRow
        ? {
            ...eventRow,
            entry_fee_units:
              eventRow.entry_fee_units != null
                ? Number(eventRow.entry_fee_units)
                : null,
            default_stake_units:
              eventRow.default_stake_units != null
                ? Number(eventRow.default_stake_units)
                : null,
          }
        : null
    );

    const mappedPlayers: PlayerRow[] = (playerRows ?? []).map(
      (p: {
        user_id: string;
        invite_status: string;
        units_delta: number | null;
        profiles:
          | { display_name: string | null }
          | { display_name: string | null }[]
          | null;
      }) => {
        const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
        return {
          user_id: p.user_id,
          display_name: profile?.display_name ?? null,
          invite_status: p.invite_status,
          units_delta: p.units_delta != null ? Number(p.units_delta) : null,
        };
      }
    );
    setPlayers(mappedPlayers);

    setLines(
      (lineRows ?? []).map((l) => ({
        id: l.id,
        player_id: l.player_id,
        side_label: l.side_label,
        odds_num: Number(l.odds_num),
        odds_den: Number(l.odds_den),
        stake_units: Number(l.stake_units),
      }))
    );

    const onEvent = new Set(mappedPlayers.map((p) => p.user_id));
    const available = ((profiles as ProfileOption[]) ?? []).filter(
      (p) => !onEvent.has(p.id)
    );
    setInviteOptions(available);
    setInviteUserId(available[0]?.id ?? "");
    setLinePlayerId(mappedPlayers.find((p) => p.invite_status === "accepted")?.user_id ?? "");
    setStakeUnits(String(eventRow?.default_stake_units ?? 10));
    if (eventRow?.wager_mode === "odds") {
      setOddsNum("2");
      setOddsDen("1");
    } else {
      setOddsNum("1");
      setOddsDen("1");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function invitePlayer() {
    if (!id || !inviteUserId) {
      Alert.alert("Pick a player");
      return;
    }
    setBusy(true);
    const entry = Number(event?.entry_fee_units) || 0;
    const { error } = await supabase.from("event_players").insert({
      event_id: id,
      user_id: inviteUserId,
      entry_paid: entry > 0,
      units_paid: entry,
      invite_status: "pending",
    });
    setBusy(false);
    if (error) {
      Alert.alert("Invite failed", error.message);
      return;
    }
    Alert.alert("Invite sent");
    void load();
  }

  async function addOddsLine() {
    if (!id) return;
    if (!linePlayerId) {
      Alert.alert("Pick a player");
      return;
    }
    const stake = Number(stakeUnits);
    const num = Number(oddsNum);
    const den = Number(oddsDen);
    if (!(stake > 0)) {
      Alert.alert("Enter a stake greater than 0");
      return;
    }
    if (!(num > 0) || !(den > 0)) {
      Alert.alert("Odds must be like 2 / 1");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("wager_lines").insert({
      event_id: id,
      player_id: linePlayerId,
      odds_num: num,
      odds_den: den,
      stake_units: stake,
    });
    setBusy(false);
    if (error) {
      Alert.alert("Couldn’t add wager", error.message);
      return;
    }
    void load();
  }

  async function removeLine(lineId: string) {
    setBusy(true);
    const { error } = await supabase.from("wager_lines").delete().eq("id", lineId);
    setBusy(false);
    if (error) {
      Alert.alert("Couldn’t remove", error.message);
      return;
    }
    void load();
  }

  return (
    <Screen>
      <Pressable onPress={() => router.back()}>
        <Text
          style={{
            color: colors.muted,
            fontFamily: "DMSans_400Regular",
            fontSize: 14,
          }}
        >
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
                key={p.user_id}
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

          {event.status !== "completed" && (
            <>
              <SectionTitle>Invite player</SectionTitle>
              {inviteOptions.length === 0 ? (
                <Muted>No other signed-up players to invite.</Muted>
              ) : (
                <View style={styles.block}>
                  <Text style={styles.label}>Player</Text>
                  <View style={styles.pickerList}>
                    {inviteOptions.map((opt) => (
                      <Pressable
                        key={opt.id}
                        onPress={() => setInviteUserId(opt.id)}
                        style={[
                          styles.pickerItem,
                          inviteUserId === opt.id && styles.pickerItemActive,
                        ]}
                      >
                        <Text style={styles.pickerText}>{opt.display_name}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <PrimaryButton
                    label={busy ? "Working…" : "Send invite"}
                    onPress={() => void invitePlayer()}
                    disabled={busy}
                    style={{ marginTop: 12, alignSelf: "flex-start" }}
                  />
                </View>
              )}

              <SectionTitle>Wagers & odds</SectionTitle>
              <ListSection>
                {lines.length === 0 ? (
                  <ListRow
                    title="No wagers yet"
                    subtitle="Add a stake or odds line below"
                    isFirst
                    isLast
                  />
                ) : (
                  lines.map((line, i) => (
                    <ListRow
                      key={line.id}
                      title={
                        line.player_id
                          ? nameById.get(line.player_id) ?? "Player"
                          : line.side_label ?? "Side"
                      }
                      subtitle={`${line.odds_num} to ${line.odds_den} · stake ${formatMoney(line.stake_units)}`}
                      isFirst={i === 0}
                      isLast={i === lines.length - 1}
                      onPress={
                        busy
                          ? undefined
                          : () =>
                              Alert.alert("Remove wager?", undefined, [
                                { text: "Cancel", style: "cancel" },
                                {
                                  text: "Remove",
                                  style: "destructive",
                                  onPress: () => void removeLine(line.id),
                                },
                              ])
                      }
                    />
                  ))
                )}
              </ListSection>

              {acceptedPlayers.length > 0 && (
                <View style={styles.block}>
                  <Text style={styles.label}>Player for line</Text>
                  <View style={styles.pickerList}>
                    {acceptedPlayers.map((p) => (
                      <Pressable
                        key={p.user_id}
                        onPress={() => setLinePlayerId(p.user_id)}
                        style={[
                          styles.pickerItem,
                          linePlayerId === p.user_id && styles.pickerItemActive,
                        ]}
                      >
                        <Text style={styles.pickerText}>
                          {p.display_name ?? "Player"}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.oddsRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Odds</Text>
                      <View style={styles.oddsInputs}>
                        <TextInput
                          keyboardType="number-pad"
                          value={oddsNum}
                          onChangeText={setOddsNum}
                          placeholderTextColor={colors.muted}
                          style={styles.oddsInput}
                        />
                        <Text style={styles.slash}>/</Text>
                        <TextInput
                          keyboardType="number-pad"
                          value={oddsDen}
                          onChangeText={setOddsDen}
                          placeholderTextColor={colors.muted}
                          style={styles.oddsInput}
                        />
                      </View>
                    </View>
                  </View>
                  <Field
                    label="Stake (money)"
                    keyboardType="decimal-pad"
                    value={stakeUnits}
                    onChangeText={setStakeUnits}
                  />
                  <PrimaryButton
                    label={busy ? "Working…" : "Add wager / odds"}
                    onPress={() => void addOddsLine()}
                    disabled={busy}
                    style={{ marginTop: 12, alignSelf: "flex-start" }}
                  />
                </View>
              )}
            </>
          )}

          <Muted>
            Settle scores on the web app for now — full mobile settle comes next.
          </Muted>
          <Text style={{ height: spacing.xl }}> </Text>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: {
    marginTop: 8,
    marginBottom: 8,
  },
  label: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: colors.muted,
    marginBottom: 8,
  },
  pickerList: {
    gap: 8,
  },
  pickerItem: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerItemActive: {
    borderColor: colors.accent,
    backgroundColor: "rgba(163, 230, 53, 0.08)",
  },
  pickerText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 15,
    color: colors.fg,
  },
  oddsRow: {
    marginTop: 12,
  },
  oddsInputs: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  oddsInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.fg,
    fontFamily: "DMSans_400Regular",
    fontSize: 16,
    backgroundColor: colors.elevated,
  },
  slash: {
    fontFamily: "DMSans_400Regular",
    fontSize: 16,
    color: colors.muted,
  },
});
