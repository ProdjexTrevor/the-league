import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  BrandTitle,
  Field,
  Muted,
  PrimaryButton,
  Screen,
  SecondaryButton,
} from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { colors, spacing } from "@/lib/theme";

type Intent = "league" | "game" | "bet" | "join" | null;
type GameStep = "details" | "players" | "odds";
type BetStep = "details" | "players";
type WagerMode = "pot" | "custom" | "odds" | "none";

type CatalogGame = {
  id: string;
  name: string;
  scoring_mode: string;
  slug: string | null;
};

type Profile = { id: string; display_name: string };

export default function CreateScreen() {
  const router = useRouter();
  const [intent, setIntent] = useState<Intent>(null);
  const [gameStep, setGameStep] = useState<GameStep>("details");
  const [betStep, setBetStep] = useState<BetStep>("details");

  const [leagueName, setLeagueName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [betNotes, setBetNotes] = useState("");
  const [entryFee, setEntryFee] = useState("10");
  const [myBetWager, setMyBetWager] = useState("10");
  const [busy, setBusy] = useState(false);

  const [catalog, setCatalog] = useState<CatalogGame[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [catalogId, setCatalogId] = useState("");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [playerSearch, setPlayerSearch] = useState("");
  const [gameSearch, setGameSearch] = useState("");
  const [wagerMode, setWagerMode] = useState<WagerMode>("pot");
  const [stake, setStake] = useState("10");
  const [playerOdds, setPlayerOdds] = useState<
    Record<string, { num: string; den: string }>
  >({});

  const loadLists = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);
    setSelectedPlayerIds((prev) =>
      prev.includes(user.id) ? prev : [user.id, ...prev]
    );

    const [{ data: games }, { data: users }] = await Promise.all([
      supabase
        .from("game_catalog")
        .select("id, name, scoring_mode, slug")
        .eq("is_active", true)
        .order("sort_order"),
      supabase.from("profiles").select("id, display_name").order("display_name"),
    ]);
    setCatalog((games as CatalogGame[]) ?? []);
    setProfiles((users as Profile[]) ?? []);
  }, []);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  const gameCatalog = useMemo(
    () => catalog.filter((g) => g.slug !== "proposition"),
    [catalog]
  );

  const filteredGames = useMemo(() => {
    const q = gameSearch.trim().toLowerCase();
    if (!q) return gameCatalog;
    return gameCatalog.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.scoring_mode.toLowerCase().includes(q)
    );
  }, [gameCatalog, gameSearch]);

  const filteredPlayers = useMemo(() => {
    const q = playerSearch.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) => p.display_name.toLowerCase().includes(q));
  }, [profiles, playerSearch]);

  function resetForm() {
    setLeagueName("");
    setJoinCode("");
    setEventTitle("");
    setBetNotes("");
    setEntryFee("10");
    setMyBetWager("10");
    setCatalogId("");
    setSelectedPlayerIds(currentUserId ? [currentUserId] : []);
    setPlayerSearch("");
    setGameSearch("");
    setWagerMode("pot");
    setStake("10");
    setPlayerOdds({});
    setGameStep("details");
    setBetStep("details");
  }

  function goBack() {
    if (intent === "game" && gameStep === "odds") {
      setGameStep("players");
      return;
    }
    if (intent === "game" && gameStep === "players") {
      setGameStep("details");
      return;
    }
    if (intent === "bet" && betStep === "players") {
      setBetStep("details");
      return;
    }
    setIntent(null);
    resetForm();
  }

  function togglePlayer(id: string) {
    if (id === currentUserId) return;
    setSelectedPlayerIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      setPlayerOdds((odds) => {
        const kept: Record<string, { num: string; den: string }> = {};
        for (const pid of next) {
          kept[pid] = odds[pid] ?? { num: "2", den: "1" };
        }
        return kept;
      });
      return next;
    });
  }

  async function createLeague() {
    if (!leagueName.trim()) {
      Alert.alert("Name required");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("create_league", {
      p_name: leagueName.trim(),
      p_description: null,
      p_entry_fee: 0,
    });
    setBusy(false);
    if (error) {
      Alert.alert("Couldn’t create league", error.message);
      return;
    }
    Alert.alert("League created", "You’re in.");
    setIntent(null);
    resetForm();
  }

  async function joinLeague() {
    if (!joinCode.trim()) {
      Alert.alert("Invite code required");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("join_league_by_code", {
      p_code: joinCode.trim().toUpperCase(),
    });
    setBusy(false);
    if (error) {
      Alert.alert("Couldn’t join", error.message);
      return;
    }
    Alert.alert("Joined", "Welcome to the league.");
    setIntent(null);
    resetForm();
  }

  function continueGameDetails() {
    if (!catalogId) {
      Alert.alert("Pick a game");
      return;
    }
    if (!eventTitle.trim()) {
      Alert.alert("Title required");
      return;
    }
    setGameStep("players");
  }

  function continueGamePlayers() {
    if (selectedPlayerIds.length < 2) {
      Alert.alert("Invite players", "Select at least one other player.");
      return;
    }
    const odds: Record<string, { num: string; den: string }> = {};
    for (const id of selectedPlayerIds) {
      odds[id] = playerOdds[id] ?? { num: "2", den: "1" };
    }
    setPlayerOdds(odds);
    setGameStep("odds");
  }

  async function createGame() {
    if (!currentUserId || !catalogId) {
      Alert.alert("Missing game or sign-in");
      return;
    }
    if (selectedPlayerIds.length < 2) {
      Alert.alert("Invite players", "Select at least one other player.");
      return;
    }
    const fee = Number(entryFee);
    const stakeNum = Number(stake);
    if (!Number.isFinite(fee) || fee < 0) {
      Alert.alert("Entry fee invalid");
      return;
    }
    if (
      (wagerMode === "pot" || wagerMode === "odds" || wagerMode === "custom") &&
      (!(Number.isFinite(stakeNum) && stakeNum > 0))
    ) {
      Alert.alert("Stake required", "Enter a stake greater than 0.");
      return;
    }
    if (wagerMode === "odds") {
      for (const id of selectedPlayerIds) {
        const o = playerOdds[id] ?? { num: "2", den: "1" };
        if (!(Number(o.num) > 0) || !(Number(o.den) > 0)) {
          Alert.alert("Odds required", "Set odds like 2 / 1 for every player.");
          return;
        }
      }
    }

    setBusy(true);
    const { data: event, error } = await supabase.rpc("create_event", {
      p_kind: "game",
      p_title: eventTitle.trim(),
      p_catalog_id: catalogId,
      p_league_id: null,
      p_entry_fee: fee,
      p_wager_mode: wagerMode,
      p_stake: wagerMode === "none" ? 0 : stakeNum,
      p_notes: null,
      p_format: null,
      p_bracket_size: null,
    });

    if (error || !event?.id) {
      setBusy(false);
      Alert.alert("Couldn’t create game", error?.message ?? "Unknown error");
      return;
    }

    const entry = Number(event.entry_fee_units) || 0;
    for (const playerId of selectedPlayerIds) {
      if (playerId === currentUserId) continue;
      const { error: playerError } = await supabase.from("event_players").insert({
        event_id: event.id,
        user_id: playerId,
        entry_paid: entry > 0,
        units_paid: entry,
        invite_status: "pending",
      });
      if (playerError) {
        setBusy(false);
        Alert.alert("Game created, invite failed", playerError.message);
        router.push(`/event/${event.id}`);
        return;
      }
    }

    if (wagerMode === "odds") {
      for (const playerId of selectedPlayerIds) {
        const o = playerOdds[playerId] ?? { num: "2", den: "1" };
        const { error: lineError } = await supabase.from("wager_lines").insert({
          event_id: event.id,
          player_id: playerId,
          odds_num: Number(o.num),
          odds_den: Number(o.den),
          stake_units: stakeNum,
        });
        if (lineError) {
          setBusy(false);
          Alert.alert("Game created, odds failed", lineError.message);
          router.push(`/event/${event.id}`);
          return;
        }
      }
    }

    if (wagerMode === "custom" && currentUserId) {
      const { error: lineError } = await supabase.from("wager_lines").insert({
        event_id: event.id,
        player_id: currentUserId,
        odds_num: 1,
        odds_den: 1,
        stake_units: stakeNum,
      });
      if (lineError) {
        setBusy(false);
        Alert.alert("Game created, stake failed", lineError.message);
        router.push(`/event/${event.id}`);
        return;
      }
    }

    setBusy(false);
    Alert.alert("Game created", "Invites sent. Open the game to manage odds.");
    setIntent(null);
    resetForm();
    router.push(`/event/${event.id}`);
  }

  function continueBetDetails() {
    if (!eventTitle.trim()) {
      Alert.alert("Title required");
      return;
    }
    if (!betNotes.trim()) {
      Alert.alert("Describe the bet");
      return;
    }
    const stakeVal = Number(myBetWager);
    if (!Number.isFinite(stakeVal) || stakeVal <= 0) {
      Alert.alert("Enter a wager greater than 0");
      return;
    }
    setBetStep("players");
  }

  async function createBet() {
    if (!eventTitle.trim()) {
      Alert.alert("Title required");
      return;
    }
    if (!betNotes.trim()) {
      Alert.alert("Describe the bet");
      return;
    }
    const stakeVal = Number(myBetWager);
    if (!Number.isFinite(stakeVal) || stakeVal <= 0) {
      Alert.alert("Enter a wager greater than 0");
      return;
    }
    if (!currentUserId) {
      Alert.alert("Not signed in");
      return;
    }
    if (selectedPlayerIds.length < 2) {
      Alert.alert("Invite the other side", "Select at least one other player.");
      return;
    }
    setBusy(true);

    const { data: propCatalog, error: catalogError } = await supabase
      .from("game_catalog")
      .select("id")
      .eq("is_active", true)
      .eq("slug", "proposition")
      .maybeSingle();

    if (catalogError || !propCatalog?.id) {
      setBusy(false);
      Alert.alert(
        "Bet catalog missing",
        catalogError?.message ?? "Run the bets migration on League Supabase."
      );
      return;
    }

    const { data: event, error } = await supabase.rpc("create_event", {
      p_kind: "bet",
      p_title: eventTitle.trim(),
      p_catalog_id: propCatalog.id,
      p_league_id: null,
      p_entry_fee: 0,
      p_wager_mode: "custom",
      p_stake: stakeVal,
      p_notes: betNotes.trim(),
      p_format: null,
      p_bracket_size: null,
    });

    if (error || !event?.id) {
      setBusy(false);
      Alert.alert("Couldn’t create bet", error?.message ?? "Unknown error");
      return;
    }

    const { error: lineError } = await supabase.from("wager_lines").insert({
      event_id: event.id,
      player_id: currentUserId,
      odds_num: 1,
      odds_den: 1,
      stake_units: stakeVal,
    });

    if (lineError) {
      setBusy(false);
      Alert.alert("Bet created, but wager failed", lineError.message);
      router.push(`/event/${event.id}`);
      return;
    }

    for (const playerId of selectedPlayerIds) {
      if (playerId === currentUserId) continue;
      const { error: playerError } = await supabase.from("event_players").insert({
        event_id: event.id,
        user_id: playerId,
        entry_paid: false,
        units_paid: 0,
        invite_status: "pending",
      });
      if (playerError) {
        setBusy(false);
        Alert.alert("Bet created, invite failed", playerError.message);
        router.push(`/event/${event.id}`);
        return;
      }
    }

    setBusy(false);
    Alert.alert("Bet created", "Invites sent. They set their stake when accepting.");
    setIntent(null);
    resetForm();
    router.push(`/event/${event.id}`);
  }

  return (
    <Screen safeBottom={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <BrandTitle size="md" />

        {!intent ? (
          <>
            <Text style={styles.hero}>Wager</Text>
            <Muted>
              One place to start — pick a league, a single game, or a single bet.
            </Muted>

            <View style={styles.choices}>
              {(
                [
                  [
                    "league",
                    "League",
                    "Season group with an invite code for ongoing wagers",
                  ],
                  [
                    "game",
                    "Single game",
                    "Pick a game, invite players, set stakes or odds",
                  ],
                  [
                    "bet",
                    "Single bet",
                    "Describe the terms and set your wager",
                  ],
                ] as const
              ).map(([key, label, desc]) => (
                <Pressable
                  key={key}
                  onPress={() => setIntent(key)}
                  style={({ pressed }) => [
                    styles.choice,
                    pressed && styles.choicePressed,
                  ]}
                >
                  <Text style={styles.choiceLabel}>{label}</Text>
                  <Text style={styles.choiceDesc}>{desc}</Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => setIntent("join")}
                style={({ pressed }) => [
                  styles.choice,
                  styles.choiceDashed,
                  pressed && styles.choicePressed,
                ]}
              >
                <Text style={styles.choiceLabel}>Join a league</Text>
                <Text style={styles.choiceDesc}>Already have an invite code?</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.hero}>
              {intent === "league"
                ? "League"
                : intent === "game"
                  ? gameStep === "details"
                    ? "Set up game"
                    : gameStep === "players"
                      ? "Add players"
                      : "Stake & odds"
                  : intent === "bet"
                    ? betStep === "details"
                      ? "Single bet"
                      : "Invite the other side"
                    : "Join a league"}
            </Text>
            <Muted>
              {intent === "game"
                ? `Step ${gameStep === "details" ? 1 : gameStep === "players" ? 2 : 3} of 3`
                : intent === "bet"
                  ? `Step ${betStep === "details" ? 1 : 2} of 2`
                  : "Part of the Wager workflow."}
            </Muted>

            {intent === "league" && (
              <>
                <Field
                  label="League name"
                  value={leagueName}
                  onChangeText={setLeagueName}
                  placeholder="Thursday Night Crew"
                />
                <PrimaryButton
                  label={busy ? "Working…" : "Create league"}
                  onPress={() => void createLeague()}
                  disabled={busy}
                  style={{ marginTop: 16, alignSelf: "flex-start" }}
                />
              </>
            )}

            {intent === "join" && (
              <>
                <Field
                  label="Invite code"
                  autoCapitalize="characters"
                  value={joinCode}
                  onChangeText={setJoinCode}
                  placeholder="ABCD1234"
                />
                <PrimaryButton
                  label={busy ? "Working…" : "Join league"}
                  onPress={() => void joinLeague()}
                  disabled={busy}
                  style={{ marginTop: 16, alignSelf: "flex-start" }}
                />
              </>
            )}

            {intent === "game" && gameStep === "details" && (
              <>
                <Text style={styles.sectionLabel}>Game</Text>
                {gameCatalog.length === 0 ? (
                  <Muted>No catalog games yet. Add them on the web app.</Muted>
                ) : (
                  <>
                    <Field
                      label="Search games"
                      value={gameSearch}
                      onChangeText={setGameSearch}
                      placeholder="Search yard, bar, card games…"
                    />
                    <ScrollView
                      style={styles.choicesScroll}
                      contentContainerStyle={styles.choicesScrollContent}
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator
                    >
                      {filteredGames.length === 0 ? (
                        <Muted>No games match that search.</Muted>
                      ) : (
                        filteredGames.map((g) => (
                          <Pressable
                            key={g.id}
                            onPress={() => {
                              setCatalogId(g.id);
                              setEventTitle((t) => t || g.name);
                            }}
                            style={[
                              styles.choice,
                              catalogId === g.id && styles.choiceActive,
                            ]}
                          >
                            <Text style={styles.choiceLabel}>{g.name}</Text>
                            <Text style={styles.choiceDesc}>
                              {g.scoring_mode}
                            </Text>
                          </Pressable>
                        ))
                      )}
                    </ScrollView>
                  </>
                )}
                <Field
                  label="Title"
                  value={eventTitle}
                  onChangeText={setEventTitle}
                  placeholder="Thursday corn hole"
                />
                <Field
                  label="Entry fee (optional, money)"
                  keyboardType="decimal-pad"
                  value={entryFee}
                  onChangeText={setEntryFee}
                />
                <PrimaryButton
                  label="Continue"
                  onPress={continueGameDetails}
                  disabled={busy}
                  style={{ marginTop: 16, alignSelf: "flex-start" }}
                />
              </>
            )}

            {intent === "game" && gameStep === "players" && (
              <>
                <Muted>
                  Invite everyone in this game. They must accept before they are
                  in. You are always included.
                </Muted>
                <Field
                  label="Search players"
                  value={playerSearch}
                  onChangeText={setPlayerSearch}
                  placeholder="Search…"
                />
                <View style={styles.choices}>
                  {filteredPlayers.map((u) => {
                    const checked = selectedPlayerIds.includes(u.id);
                    const locked = u.id === currentUserId;
                    return (
                      <Pressable
                        key={u.id}
                        disabled={locked}
                        onPress={() => togglePlayer(u.id)}
                        style={[
                          styles.choice,
                          checked && styles.choiceActive,
                          locked && { opacity: 0.9 },
                        ]}
                      >
                        <Text style={styles.choiceLabel}>
                          {u.display_name}
                          {locked ? " (you)" : ""}
                        </Text>
                        <Text style={styles.choiceDesc}>
                          {checked ? "Selected" : "Tap to invite"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Muted>Selected: {selectedPlayerIds.length}</Muted>
                <PrimaryButton
                  label="Continue"
                  onPress={continueGamePlayers}
                  disabled={busy}
                  style={{ marginTop: 16, alignSelf: "flex-start" }}
                />
              </>
            )}

            {intent === "game" && gameStep === "odds" && (
              <>
                <View style={styles.choices}>
                  {(
                    [
                      ["pot", "Equal pot", `Everyone puts in ${stake || "10"}`],
                      ["custom", "Custom", "Each player puts up their own amount"],
                      ["odds", "Odds", "Fractional odds per player"],
                      ["none", "No wager", "Just track who won"],
                    ] as const
                  ).map(([key, label, desc]) => (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      accessibilityState={{ selected: wagerMode === key }}
                      onPress={() => {
                        setWagerMode(key);
                        if (key === "odds") {
                          setPlayerOdds((prev) => {
                            const next = { ...prev };
                            for (const id of selectedPlayerIds) {
                              next[id] = next[id] ?? { num: "2", den: "1" };
                            }
                            return next;
                          });
                        }
                      }}
                      style={({ pressed }) => [
                        styles.choice,
                        wagerMode === key && styles.choiceActive,
                        pressed && styles.choicePressed,
                      ]}
                    >
                      <Text style={styles.choiceLabel} pointerEvents="none">
                        {label}
                      </Text>
                      <Text style={styles.choiceDesc} pointerEvents="none">
                        {desc}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {(wagerMode === "pot" || wagerMode === "odds") && (
                  <Field
                    label={
                      wagerMode === "odds"
                        ? "Stake on each odds line (money)"
                        : "Stake per player (money)"
                    }
                    keyboardType="decimal-pad"
                    value={stake}
                    onChangeText={setStake}
                  />
                )}

                {wagerMode === "custom" && (
                  <>
                    <Muted style={{ marginTop: 8 }}>
                      Enter each player’s stake now (or add lines on the game
                      screen before settling).
                    </Muted>
                    <Field
                      label="Your stake (others can be set on the game)"
                      keyboardType="decimal-pad"
                      value={stake}
                      onChangeText={setStake}
                      placeholder="10"
                    />
                  </>
                )}

                {wagerMode === "odds" && (
                  <View style={{ marginTop: 8, gap: 12 }}>
                    <Muted>Tap a box and enter fractional odds like 2 / 1.</Muted>
                    {selectedPlayerIds.map((id) => {
                      const name =
                        profiles.find((p) => p.id === id)?.display_name ??
                        "Player";
                      const odds = playerOdds[id] ?? { num: "2", den: "1" };
                      return (
                        <View key={id} style={styles.oddsRow}>
                          <Text style={styles.oddsName} numberOfLines={1}>
                            {name}
                          </Text>
                          <TextInput
                            keyboardType="number-pad"
                            value={odds.num}
                            onChangeText={(num) =>
                              setPlayerOdds((prev) => ({
                                ...prev,
                                [id]: { ...odds, num },
                              }))
                            }
                            placeholder="2"
                            placeholderTextColor={colors.muted}
                            style={styles.oddsInput}
                            editable
                            selectTextOnFocus
                          />
                          <Text style={styles.oddsSlash}>/</Text>
                          <TextInput
                            keyboardType="number-pad"
                            value={odds.den}
                            onChangeText={(den) =>
                              setPlayerOdds((prev) => ({
                                ...prev,
                                [id]: { ...odds, den },
                              }))
                            }
                            placeholder="1"
                            placeholderTextColor={colors.muted}
                            style={styles.oddsInput}
                            editable
                            selectTextOnFocus
                          />
                        </View>
                      );
                    })}
                  </View>
                )}

                <PrimaryButton
                  label={busy ? "Creating…" : "Create game & send invites"}
                  onPress={() => void createGame()}
                  disabled={busy}
                  style={{ marginTop: 16, alignSelf: "flex-start" }}
                />
              </>
            )}

            {intent === "bet" && betStep === "details" && (
              <>
                <Field
                  label="Title"
                  value={eventTitle}
                  onChangeText={setEventTitle}
                  placeholder="Lakers cover the spread"
                />
                <Field
                  label="What is the bet?"
                  value={betNotes}
                  onChangeText={setBetNotes}
                  placeholder="Terms, sides, how you settle"
                  multiline
                />
                <Field
                  label="Your wager (money)"
                  keyboardType="decimal-pad"
                  value={myBetWager}
                  onChangeText={setMyBetWager}
                />
                <PrimaryButton
                  label="Continue"
                  onPress={continueBetDetails}
                  disabled={busy}
                  style={{ marginTop: 16, alignSelf: "flex-start" }}
                />
              </>
            )}

            {intent === "bet" && betStep === "players" && (
              <>
                <Muted>
                  Invite who you’re betting against. They accept and set their
                  own stake. Then settle win / loss on the bet screen.
                </Muted>
                <Field
                  label="Search players"
                  value={playerSearch}
                  onChangeText={setPlayerSearch}
                  placeholder="Search…"
                />
                <View style={styles.choices}>
                  {filteredPlayers.map((u) => {
                    const checked = selectedPlayerIds.includes(u.id);
                    const locked = u.id === currentUserId;
                    return (
                      <Pressable
                        key={u.id}
                        disabled={locked}
                        onPress={() => togglePlayer(u.id)}
                        style={[
                          styles.choice,
                          checked && styles.choiceActive,
                          locked && { opacity: 0.9 },
                        ]}
                      >
                        <Text style={styles.choiceLabel}>
                          {u.display_name}
                          {locked ? " (you)" : ""}
                        </Text>
                        <Text style={styles.choiceDesc}>
                          {checked ? "Selected" : "Tap to invite"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Muted>Selected: {selectedPlayerIds.length}</Muted>
                <PrimaryButton
                  label={busy ? "Creating…" : "Create bet & send invites"}
                  onPress={() => void createBet()}
                  disabled={busy}
                  style={{ marginTop: 16, alignSelf: "flex-start" }}
                />
              </>
            )}

            <View style={{ marginTop: 20 }}>
              <SecondaryButton label="Back" onPress={goBack} disabled={busy} />
            </View>
          </>
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    fontFamily: "DMSans_700Bold",
    fontSize: 28,
    color: colors.fg,
    marginTop: 28,
    letterSpacing: -0.4,
  },
  sectionLabel: {
    fontFamily: "DMSans_500Medium",
    fontSize: 14,
    color: colors.muted,
    marginTop: 20,
    marginBottom: 8,
  },
  choicesScroll: {
    marginTop: 16,
    maxHeight: 240,
  },
  choicesScrollContent: {
    gap: 12,
    paddingBottom: 4,
  },
  choices: {
    marginTop: 16,
    gap: 12,
  },
  choice: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 2,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  choiceActive: {
    borderColor: colors.accent,
    backgroundColor: "rgba(163, 230, 53, 0.08)",
  },
  choiceDashed: {
    borderStyle: "dashed",
  },
  choicePressed: {
    borderColor: colors.accent,
    backgroundColor: "rgba(163, 230, 53, 0.08)",
  },
  choiceLabel: {
    fontFamily: "DMSans_500Medium",
    fontSize: 16,
    color: colors.fg,
  },
  choiceDesc: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: colors.muted,
    marginTop: 4,
    lineHeight: 20,
  },
  oddsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  oddsName: {
    fontFamily: "DMSans_500Medium",
    fontSize: 14,
    color: colors.fg,
    flex: 1,
    minWidth: 0,
  },
  oddsSlash: {
    fontFamily: "DMSans_400Regular",
    fontSize: 16,
    color: colors.muted,
  },
  oddsInput: {
    width: 64,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 2,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: colors.fg,
    fontFamily: "DMSans_400Regular",
    fontSize: 16,
    backgroundColor: colors.elevated,
    textAlign: "center",
  },
});
