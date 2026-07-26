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
import { useAuth } from "@/lib/auth";
import { settleEvent } from "@/lib/settle";
import { supabase } from "@/lib/supabase";
import { colors, eventKindLabel, spacing } from "@/lib/theme";
import { formatMoney } from "@/lib/venmo";
import {
  formatOdds,
  liability,
  scoringModeLabel,
  wagerModeLabel,
  type ScoringMode,
} from "@/lib/wager";

type PlayerRow = {
  user_id: string;
  display_name: string | null;
  invite_status: string;
  units_delta: number | null;
  side_label: string | null;
  score: number | null;
  placement: number | null;
  outcome: string | null;
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
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [event, setEvent] = useState<{
    title: string;
    status: string;
    kind: string;
    notes: string | null;
    entry_fee_units: number | null;
    wager_mode: string | null;
    default_stake_units: number | null;
    catalog_id: string | null;
  } | null>(null);
  const [scoringMode, setScoringMode] = useState<ScoringMode>("placement");
  const [catalogName, setCatalogName] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [lines, setLines] = useState<LineRow[]>([]);
  const [inviteOptions, setInviteOptions] = useState<ProfileOption[]>([]);
  const [inviteUserId, setInviteUserId] = useState("");
  const [inviteSideLabel, setInviteSideLabel] = useState("");
  const [linePlayerId, setLinePlayerId] = useState("");
  const [sideLabel, setSideLabel] = useState("");
  const [oddsNum, setOddsNum] = useState("2");
  const [oddsDen, setOddsDen] = useState("1");
  const [stakeUnits, setStakeUnits] = useState("10");
  const [acceptWager, setAcceptWager] = useState("10");
  const [settleInputs, setSettleInputs] = useState<
    Record<string, { score: string; placement: string; outcome: string }>
  >({});

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

  const pendingCount = useMemo(
    () => players.filter((p) => p.invite_status === "pending").length,
    [players]
  );

  const myRow = useMemo(
    () => (user ? players.find((p) => p.user_id === user.id) : undefined),
    [players, user]
  );
  const myInviteStatus = myRow?.invite_status ?? null;
  const needsMyWagerOnAccept =
    event?.kind === "bet" && event?.wager_mode === "custom";
  const showWagerBoard =
    event?.wager_mode === "custom" ||
    event?.wager_mode === "odds" ||
    event?.status !== "completed";
  const showOddsInputs = event?.wager_mode !== "custom";

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: eventRow }, { data: playerRows }, { data: lineRows }, { data: profiles }] =
      await Promise.all([
        supabase
          .from("events")
          .select(
            "title, status, kind, notes, entry_fee_units, wager_mode, default_stake_units, catalog_id"
          )
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("event_players")
          .select(
            "user_id, invite_status, units_delta, side_label, score, placement, outcome, profiles(display_name)"
          )
          .eq("event_id", id),
        supabase
          .from("wager_lines")
          .select("id, player_id, side_label, odds_num, odds_den, stake_units")
          .eq("event_id", id),
        supabase.from("profiles").select("id, display_name").order("display_name"),
      ]);

    let mode: ScoringMode = "placement";
    let catName: string | null = null;
    if (eventRow?.catalog_id) {
      const { data: catalog } = await supabase
        .from("game_catalog")
        .select("name, scoring_mode")
        .eq("id", eventRow.catalog_id)
        .maybeSingle();
      if (catalog?.scoring_mode) {
        mode = catalog.scoring_mode as ScoringMode;
      }
      catName = catalog?.name ?? null;
    }
    setScoringMode(mode);
    setCatalogName(catName);

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
        side_label: string | null;
        score: number | null;
        placement: number | null;
        outcome: string | null;
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
          side_label: p.side_label,
          score: p.score != null ? Number(p.score) : null,
          placement: p.placement != null ? Number(p.placement) : null,
          outcome: p.outcome,
        };
      }
    );
    setPlayers(mappedPlayers);

    const nextSettle: Record<
      string,
      { score: string; placement: string; outcome: string }
    > = {};
    for (const p of mappedPlayers.filter(
      (x) => (x.invite_status ?? "accepted") === "accepted"
    )) {
      nextSettle[p.user_id] = {
        score: p.score != null ? String(p.score) : "",
        placement: p.placement != null ? String(p.placement) : "",
        outcome: p.outcome ?? "",
      };
    }
    setSettleInputs(nextSettle);

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
    setLinePlayerId(
      mappedPlayers.find((p) => p.invite_status === "accepted")?.user_id ?? ""
    );
    setStakeUnits(String(eventRow?.default_stake_units ?? 10));
    setAcceptWager(String(eventRow?.default_stake_units ?? 10));
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
      side_label: inviteSideLabel.trim() || null,
      entry_paid: entry > 0,
      units_paid: entry,
      invite_status: "pending",
    });
    setBusy(false);
    if (error) {
      Alert.alert("Invite failed", error.message);
      return;
    }
    setInviteSideLabel("");
    Alert.alert("Invite sent");
    void load();
  }

  async function acceptInvite() {
    if (!id) return;
    const wagerVal = Number(acceptWager);
    if (needsMyWagerOnAccept && (!(Number.isFinite(wagerVal) && wagerVal > 0))) {
      Alert.alert("Enter your wager", "How much money are you putting up?");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("accept_event_invite", {
      p_event_id: id,
      p_wager_units: needsMyWagerOnAccept ? wagerVal : null,
    });
    setBusy(false);
    if (error) {
      Alert.alert("Couldn’t accept", error.message);
      return;
    }
    void load();
  }

  async function declineInvite() {
    if (!id) return;
    setBusy(true);
    const { error } = await supabase.rpc("decline_event_invite", {
      p_event_id: id,
    });
    setBusy(false);
    if (error) {
      Alert.alert("Couldn’t decline", error.message);
      return;
    }
    void load();
  }

  async function addOddsLine() {
    if (!id) return;
    const playerId = linePlayerId.trim() || null;
    const side = sideLabel.trim() || null;
    if (!playerId && !side) {
      Alert.alert("Pick a player or enter a side label");
      return;
    }
    const stake = Number(stakeUnits);
    const num = Number(oddsNum);
    const den = Number(oddsDen);
    if (!(stake > 0)) {
      Alert.alert("Enter a stake greater than 0");
      return;
    }
    if (showOddsInputs && (!(num > 0) || !(den > 0))) {
      Alert.alert("Odds must be like 2 / 1");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("wager_lines").insert({
      event_id: id,
      player_id: playerId,
      side_label: side,
      odds_num: showOddsInputs ? num : 1,
      odds_den: showOddsInputs ? den : 1,
      stake_units: stake,
    });
    setBusy(false);
    if (error) {
      Alert.alert("Couldn’t add wager", error.message);
      return;
    }
    setSideLabel("");
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

  async function completeSettle() {
    if (!id) return;
    const results = acceptedPlayers.map((p) => {
      const input = settleInputs[p.user_id] ?? {
        score: "",
        placement: "",
        outcome: "",
      };
      return {
        user_id: p.user_id,
        score: input.score === "" ? null : Number(input.score),
        placement: input.placement === "" ? null : Number(input.placement),
        outcome: input.outcome || null,
      };
    });

    setBusy(true);
    const { error } = await settleEvent(id, results);
    setBusy(false);
    if (error) {
      Alert.alert("Couldn’t settle", error);
      return;
    }
    Alert.alert("Settled", "Results saved and wallet updated.");
    void load();
  }

  function updateSettle(
    userId: string,
    patch: Partial<{ score: string; placement: string; outcome: string }>
  ) {
    setSettleInputs((prev) => ({
      ...prev,
      [userId]: {
        score: prev[userId]?.score ?? "",
        placement: prev[userId]?.placement ?? "",
        outcome: prev[userId]?.outcome ?? "",
        ...patch,
      },
    }));
  }

  function lineSubtitle(line: LineRow): string {
    const isCustomEven =
      event?.wager_mode === "custom" &&
      line.odds_num === 1 &&
      line.odds_den === 1;
    if (isCustomEven) {
      return `${formatMoney(line.stake_units)} money`;
    }
    const opp =
      Number(line.stake_units) > 0 &&
      (line.odds_num !== 1 || line.odds_den !== 1)
        ? ` · opposite puts up ${liability(line.stake_units, line.odds_num, line.odds_den).toFixed(0)}`
        : "";
    return `${formatOdds(line.odds_num, line.odds_den)} · stake ${formatMoney(line.stake_units)}${opp}`;
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
          <Muted style={{ marginTop: 20 }}>
            {eventKindLabel(event.kind)}
            {catalogName ? ` · ${catalogName}` : ""} · {event.status}
          </Muted>
          <Text
            style={{
              fontFamily: "DMSans_700Bold",
              fontSize: 22,
              color: colors.fg,
              marginTop: 8,
            }}
          >
            {event.title}
          </Text>
          <Muted>
            {scoringModeLabel(scoringMode)} · entry{" "}
            {formatMoney(event.entry_fee_units ?? 0)} · wager{" "}
            {wagerModeLabel(event.wager_mode ?? "none")}
            {event.wager_mode === "pot"
              ? ` · stake ${formatMoney(event.default_stake_units ?? 0)}`
              : ""}
          </Muted>
          {event.notes ? (
            <Text style={styles.notes}>
              {event.kind === "bet" ? (
                <>
                  <Text style={styles.notesLabel}>Terms · </Text>
                  {event.notes}
                </>
              ) : (
                event.notes
              )}
            </Text>
          ) : null}
          {pendingCount > 0 && event.status !== "completed" ? (
            <Text style={styles.pendingBanner}>
              {pendingCount} invite{pendingCount === 1 ? "" : "s"} waiting to
              accept
            </Text>
          ) : null}

          {myInviteStatus === "pending" && event.status !== "completed" && (
            <View style={styles.inviteCard}>
              <SectionTitle>You’re invited</SectionTitle>
              <Muted>
                Accept to join this {eventKindLabel(event.kind).toLowerCase()}.
                {needsMyWagerOnAccept
                  ? " Enter how much money you are putting up."
                  : ""}
              </Muted>
              {needsMyWagerOnAccept && (
                <Field
                  label="Your wager (money)"
                  keyboardType="decimal-pad"
                  value={acceptWager}
                  onChangeText={setAcceptWager}
                />
              )}
              <PrimaryButton
                label={busy ? "Working…" : "Accept"}
                onPress={() => void acceptInvite()}
                disabled={busy}
                style={{ marginTop: 12, alignSelf: "flex-start" }}
              />
              <Pressable
                onPress={() => void declineInvite()}
                disabled={busy}
                style={{ marginTop: 12 }}
              >
                <Text style={styles.decline}>Decline invite</Text>
              </Pressable>
            </View>
          )}

          <SectionTitle>Players</SectionTitle>
          <ListSection>
            {players.map((p, i) => {
              const status = p.invite_status ?? "accepted";
              const subtitle =
                event.status === "completed"
                  ? [
                      p.placement ? `#${p.placement}` : null,
                      p.score != null ? `score ${p.score}` : null,
                      p.outcome,
                      p.units_delta != null
                        ? `${p.units_delta >= 0 ? "+" : ""}${formatMoney(p.units_delta)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : status === "accepted"
                    ? "In"
                    : status === "pending"
                      ? "Invited"
                      : "Declined";
              return (
                <ListRow
                  key={p.user_id}
                  title={`${p.display_name ?? "Player"}${
                    p.side_label ? ` (${p.side_label})` : ""
                  }`}
                  subtitle={subtitle}
                  isFirst={i === 0}
                  isLast={i === players.length - 1}
                />
              );
            })}
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
                  <Field
                    label="Side label (optional)"
                    value={inviteSideLabel}
                    onChangeText={setInviteSideLabel}
                    placeholder="Team A / Over / etc."
                  />
                  <PrimaryButton
                    label={busy ? "Working…" : "Send invite"}
                    onPress={() => void invitePlayer()}
                    disabled={busy}
                    style={{ marginTop: 12, alignSelf: "flex-start" }}
                  />
                </View>
              )}
            </>
          )}

          {showWagerBoard && (
            <>
              <SectionTitle>
                {event.wager_mode === "custom"
                  ? "Custom wagers"
                  : event.wager_mode === "odds"
                    ? "Odds board"
                    : "Wagers & odds"}
              </SectionTitle>
              <Muted>
                {event.wager_mode === "custom"
                  ? event.kind === "bet"
                    ? "Each side enters their own stake. Losers forfeit; winners take that pot."
                    : "Each player or team puts up the money shown."
                  : event.wager_mode === "odds"
                    ? `Fractional odds. Example: ${formatOdds(2, 1)} on stake ${formatMoney(event.default_stake_units ?? 0)}.`
                    : "Add stake lines or fractional odds for this game."}
              </Muted>
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
                      subtitle={lineSubtitle(line)}
                      isFirst={i === 0}
                      isLast={i === lines.length - 1}
                      onPress={
                        event.status === "completed" || busy
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

              {event.status !== "completed" && acceptedPlayers.length > 0 && (
                <View style={styles.block}>
                  <Text style={styles.label}>Player for line</Text>
                  <View style={styles.pickerList}>
                    <Pressable
                      onPress={() => setLinePlayerId("")}
                      style={[
                        styles.pickerItem,
                        !linePlayerId && styles.pickerItemActive,
                      ]}
                    >
                      <Text style={styles.pickerText}>
                        None (use side label)
                      </Text>
                    </Pressable>
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
                  <Field
                    label="Team / side label"
                    value={sideLabel}
                    onChangeText={setSideLabel}
                    placeholder="Optional if player selected"
                  />
                  {showOddsInputs && (
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
                  )}
                  <Field
                    label="Stake (money)"
                    keyboardType="decimal-pad"
                    value={stakeUnits}
                    onChangeText={setStakeUnits}
                  />
                  <PrimaryButton
                    label={
                      busy
                        ? "Working…"
                        : event.wager_mode === "custom"
                          ? "Add wager"
                          : "Add wager / odds"
                    }
                    onPress={() => void addOddsLine()}
                    disabled={busy}
                    style={{ marginTop: 12, alignSelf: "flex-start" }}
                  />
                </View>
              )}
            </>
          )}

          {event.status !== "completed" &&
            acceptedPlayers.length >= 1 &&
            myInviteStatus !== "pending" && (
              <>
                <SectionTitle>Settle results</SectionTitle>
                <Muted>
                  Enter results for {scoringModeLabel(scoringMode)}.
                  {pendingCount > 0
                    ? " Waiting on pending invites before settle will succeed."
                    : ""}
                </Muted>
                <View style={styles.block}>
                  {acceptedPlayers.map((p) => {
                    const input = settleInputs[p.user_id] ?? {
                      score: "",
                      placement: "",
                      outcome: "",
                    };
                    return (
                      <View key={p.user_id} style={styles.settleRow}>
                        <Text style={styles.settleName}>
                          {p.display_name ?? "Player"}
                        </Text>
                        {(scoringMode === "higher_wins" ||
                          scoringMode === "lower_wins") && (
                          <TextInput
                            keyboardType="decimal-pad"
                            value={input.score}
                            onChangeText={(score) =>
                              updateSettle(p.user_id, { score })
                            }
                            placeholder="Score"
                            placeholderTextColor={colors.muted}
                            style={styles.settleInput}
                          />
                        )}
                        {(scoringMode === "placement" ||
                          scoringMode === "custom") && (
                          <TextInput
                            keyboardType="number-pad"
                            value={input.placement}
                            onChangeText={(placement) =>
                              updateSettle(p.user_id, { placement })
                            }
                            placeholder="#"
                            placeholderTextColor={colors.muted}
                            style={styles.settleInput}
                          />
                        )}
                        {scoringMode === "head_to_head" && (
                          <View style={styles.outcomeRow}>
                            {(["win", "loss", "draw"] as const).map((o) => (
                              <Pressable
                                key={o}
                                onPress={() =>
                                  updateSettle(p.user_id, { outcome: o })
                                }
                                style={[
                                  styles.outcomeChip,
                                  input.outcome === o &&
                                    styles.outcomeChipActive,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.outcomeText,
                                    input.outcome === o &&
                                      styles.outcomeTextActive,
                                  ]}
                                >
                                  {o === "win"
                                    ? "Win"
                                    : o === "loss"
                                      ? "Loss"
                                      : "Draw"}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })}
                  <PrimaryButton
                    label={busy ? "Settling…" : "Complete & settle"}
                    onPress={() => void completeSettle()}
                    disabled={busy}
                    style={{ marginTop: 16, alignSelf: "flex-start" }}
                  />
                  {pendingCount > 0 ? (
                    <Muted style={{ marginTop: 8 }}>
                      Settle is blocked until invites are accepted or declined.
                    </Muted>
                  ) : null}
                </View>
              </>
            )}

          {event.status === "completed" ? (
            <Muted style={{ marginTop: 8 }}>
              Settled. Check Wallet for any Venmo IOUs.
            </Muted>
          ) : null}

          <Text style={{ height: spacing.xl }}> </Text>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  notes: {
    marginTop: 12,
    fontFamily: "DMSans_400Regular",
    fontSize: 15,
    color: colors.fg,
    lineHeight: 22,
  },
  notesLabel: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: colors.muted,
  },
  pendingBanner: {
    marginTop: 12,
    fontFamily: "DMSans_500Medium",
    fontSize: 14,
    color: colors.accent,
  },
  inviteCard: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: "rgba(214, 255, 75, 0.4)",
    backgroundColor: "rgba(214, 255, 75, 0.05)",
    padding: 16,
    borderRadius: 2,
  },
  decline: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: colors.muted,
    textDecorationLine: "underline",
  },
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
  settleRow: {
    marginBottom: 14,
    gap: 8,
  },
  settleName: {
    fontFamily: "DMSans_500Medium",
    fontSize: 15,
    color: colors.fg,
  },
  settleInput: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.fg,
    fontFamily: "DMSans_400Regular",
    fontSize: 16,
    backgroundColor: colors.elevated,
    maxWidth: 140,
  },
  outcomeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  outcomeChip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 2,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  outcomeChipActive: {
    borderColor: colors.accent,
    backgroundColor: "rgba(163, 230, 53, 0.08)",
  },
  outcomeText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 14,
    color: colors.muted,
  },
  outcomeTextActive: {
    color: colors.fg,
  },
});
