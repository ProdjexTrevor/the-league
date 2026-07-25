import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

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

export default function CreateScreen() {
  const [intent, setIntent] = useState<Intent>(null);
  const [leagueName, setLeagueName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [betNotes, setBetNotes] = useState("");
  const [entryFee, setEntryFee] = useState("10");
  const [myBetWager, setMyBetWager] = useState("10");
  const [busy, setBusy] = useState(false);

  function resetForm() {
    setLeagueName("");
    setJoinCode("");
    setEventTitle("");
    setBetNotes("");
    setEntryFee("10");
    setMyBetWager("10");
  }

  function goBack() {
    setIntent(null);
    resetForm();
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
    goBack();
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
    goBack();
  }

  async function createGame() {
    if (!eventTitle.trim()) {
      Alert.alert("Title required");
      return;
    }
    const fee = Number(entryFee);
    if (!Number.isFinite(fee) || fee < 0) {
      Alert.alert("Entry fee invalid");
      return;
    }
    setBusy(true);

    const { data: catalog, error: catalogError } = await supabase
      .from("game_catalog")
      .select("id")
      .eq("is_active", true)
      .neq("slug", "proposition")
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (catalogError || !catalog?.id) {
      setBusy(false);
      Alert.alert(
        "No games in catalog",
        catalogError?.message ?? "Add a catalog game on the web app first."
      );
      return;
    }

    const { error } = await supabase.rpc("create_event", {
      p_kind: "game",
      p_title: eventTitle.trim(),
      p_catalog_id: catalog.id,
      p_league_id: null,
      p_entry_fee: fee,
      p_wager_mode: "pot",
      p_stake: fee,
      p_notes: null,
      p_format: null,
      p_bracket_size: null,
    });

    setBusy(false);
    if (error) {
      Alert.alert("Couldn’t create game", error.message);
      return;
    }
    Alert.alert("Game created", "Find it on Home. Invite players from the web app for now.");
    goBack();
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
    const stake = Number(myBetWager);
    if (!Number.isFinite(stake) || stake <= 0) {
      Alert.alert("Enter a wager greater than 0");
      return;
    }
    setBusy(true);

    const { data: catalog, error: catalogError } = await supabase
      .from("game_catalog")
      .select("id")
      .eq("is_active", true)
      .eq("slug", "proposition")
      .maybeSingle();

    if (catalogError || !catalog?.id) {
      setBusy(false);
      Alert.alert(
        "Bet catalog missing",
        catalogError?.message ?? "Run the bets migration on League Supabase."
      );
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      Alert.alert("Not signed in");
      return;
    }

    const { data: event, error } = await supabase.rpc("create_event", {
      p_kind: "bet",
      p_title: eventTitle.trim(),
      p_catalog_id: catalog.id,
      p_league_id: null,
      p_entry_fee: 0,
      p_wager_mode: "custom",
      p_stake: stake,
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
      player_id: user.id,
      odds_num: 1,
      odds_den: 1,
      stake_units: stake,
    });

    setBusy(false);
    if (lineError) {
      Alert.alert("Bet created, but wager failed", lineError.message);
      goBack();
      return;
    }
    Alert.alert("Bet created", "Find it on Home. Invite the other side from the web app for now.");
    goBack();
  }

  return (
    <Screen safeBottom={false}>
      <ScrollView showsVerticalScrollIndicator={false}>
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
                    "Pick a title and stake for a quick pot game",
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
                  ? "Single game"
                  : intent === "bet"
                    ? "Single bet"
                    : "Join a league"}
            </Text>
            <Muted>Part of the Wager workflow.</Muted>

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

            {intent === "game" && (
              <>
                <Field
                  label="Title"
                  value={eventTitle}
                  onChangeText={setEventTitle}
                  placeholder="Thursday corn hole"
                />
                <Field
                  label="Stake / entry (money)"
                  keyboardType="decimal-pad"
                  value={entryFee}
                  onChangeText={setEntryFee}
                />
                <PrimaryButton
                  label={busy ? "Working…" : "Create game"}
                  onPress={() => void createGame()}
                  disabled={busy}
                  style={{ marginTop: 16, alignSelf: "flex-start" }}
                />
              </>
            )}

            {intent === "bet" && (
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
                  label={busy ? "Working…" : "Create bet"}
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
  choices: {
    marginTop: 24,
    gap: 12,
  },
  choice: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 2,
    paddingHorizontal: 16,
    paddingVertical: 16,
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
});
