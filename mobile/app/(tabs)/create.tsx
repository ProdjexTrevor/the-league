import { useState } from "react";
import { Alert, ScrollView, View } from "react-native";

import {
  BrandTitle,
  Field,
  Muted,
  PrimaryButton,
  Screen,
  SectionTitle,
} from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { spacing } from "@/lib/theme";

export default function CreateScreen() {
  const [leagueName, setLeagueName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [entryFee, setEntryFee] = useState("10");
  const [busy, setBusy] = useState(false);

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
    setLeagueName("");
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
    setJoinCode("");
  }

  async function createQuickGame() {
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
      p_stake: 0,
      p_notes: null,
      p_format: null,
      p_bracket_size: null,
    });

    setBusy(false);
    if (error) {
      Alert.alert("Couldn’t create event", error.message);
      return;
    }
    Alert.alert("Event created", "Find it on Home.");
    setEventTitle("");
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <BrandTitle size="md" />
        <Muted>Start a league, join with a code, or spin up a quick pot game.</Muted>

        <SectionTitle>New league</SectionTitle>
        <Field label="League name" value={leagueName} onChangeText={setLeagueName} />
        <PrimaryButton
          label={busy ? "Working…" : "Create league"}
          onPress={() => void createLeague()}
          disabled={busy}
          style={{ marginTop: 16, alignSelf: "flex-start" }}
        />

        <SectionTitle>Join league</SectionTitle>
        <Field
          label="Invite code"
          autoCapitalize="characters"
          value={joinCode}
          onChangeText={setJoinCode}
        />
        <PrimaryButton
          label={busy ? "Working…" : "Join"}
          onPress={() => void joinLeague()}
          disabled={busy}
          style={{ marginTop: 16, alignSelf: "flex-start" }}
        />

        <SectionTitle>Quick pot game</SectionTitle>
        <Field label="Title" value={eventTitle} onChangeText={setEventTitle} />
        <Field
          label="Entry fee"
          keyboardType="decimal-pad"
          value={entryFee}
          onChangeText={setEntryFee}
        />
        <PrimaryButton
          label={busy ? "Working…" : "Create game"}
          onPress={() => void createQuickGame()}
          disabled={busy}
          style={{ marginTop: 16, alignSelf: "flex-start" }}
        />
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </Screen>
  );
}
