import * as Linking from "expo-linking";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { Text } from "react-native-paper";

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
import { colors } from "@/lib/theme";
import { formatMoney, venmoPayUrl } from "@/lib/venmo";

type Obligation = {
  id: string;
  amount: number;
  to_user_id: string;
  from_user_id: string;
  to_profile?: { display_name: string | null; venmo_username: string | null } | null;
  from_profile?: { display_name: string | null; venmo_username: string | null } | null;
  event?: { title: string | null } | null;
};

export default function WalletScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [owed, setOwed] = useState<Obligation[]>([]);
  const [owedToMe, setOwedToMe] = useState<Obligation[]>([]);
  const [venmo, setVenmo] = useState<string | null>(null);
  const [selected, setSelected] = useState<Obligation | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: me }, { data, error }] = await Promise.all([
      supabase.from("profiles").select("venmo_username").eq("id", user.id).maybeSingle(),
      supabase
        .from("wallet_obligations")
        .select("id, amount, status, to_user_id, from_user_id, event_id, events(title)")
        .eq("status", "open")
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`),
    ]);

    setVenmo(me?.venmo_username ?? null);

    if (error) {
      setLoading(false);
      Alert.alert("Wallet error", error.message);
      return;
    }

    const rows = data ?? [];
    const userIds = Array.from(
      new Set(rows.flatMap((r) => [r.from_user_id, r.to_user_id]))
    );
    const { data: profiles } =
      userIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, display_name, venmo_username")
            .in("id", userIds)
        : { data: [] };
    const byId = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

    const enriched = rows.map((r) => ({
      ...r,
      amount: Number(r.amount),
      to_profile: byId[r.to_user_id],
      from_profile: byId[r.from_user_id],
      event: Array.isArray(r.events) ? r.events[0] : r.events,
    })) as Obligation[];

    const mine = enriched.filter((r) => r.from_user_id === user.id);
    setOwed(mine);
    setOwedToMe(enriched.filter((r) => r.to_user_id === user.id));
    setSelected((prev) => {
      if (!prev) return mine[0] ?? null;
      return mine.find((r) => r.id === prev.id) ?? mine[0] ?? null;
    });
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function markPaid(id: string) {
    const { error } = await supabase
      .from("wallet_obligations")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      Alert.alert("Couldn’t mark paid", error.message);
      return;
    }
    void load();
  }

  async function payOnVenmo(row: Obligation) {
    const username = row.to_profile?.venmo_username;
    if (!username) {
      Alert.alert("No Venmo", "That player hasn’t added a Venmo username yet.");
      return;
    }
    await Linking.openURL(
      venmoPayUrl({
        username,
        amount: row.amount,
        note: row.event?.title ?? "The League",
      })
    );
  }

  const totalOwed = owed.reduce((s, r) => s + r.amount, 0);
  const totalDue = owedToMe.reduce((s, r) => s + r.amount, 0);

  return (
    <Screen
      bottomBar={
        selected ? (
          <View style={{ gap: 10 }}>
            <BigButton
              label={`Pay ${formatMoney(selected.amount)} on Venmo`}
              icon="cash"
              onPress={() => void payOnVenmo(selected)}
            />
            <BigButton
              label="Mark paid"
              mode="outlined"
              icon="check"
              onPress={() => void markPaid(selected.id)}
            />
          </View>
        ) : (
          <BigButton
            label="Back home"
            mode="outlined"
            icon="home"
            onPress={() => router.push("/(tabs)/home")}
          />
        )
      }
    >
      <BrandMark compact />
      <Subtle>{venmo ? `Your Venmo @${venmo}` : "Add Venmo on the web if missing."}</Subtle>

      <View style={{ flexDirection: "row", gap: 16, marginTop: 24 }}>
        <View style={{ flex: 1, backgroundColor: colors.elevated, borderRadius: 16, padding: 16 }}>
          <Text style={{ color: colors.muted, fontFamily: "DMSans_400Regular" }}>You owe</Text>
          <Text style={{ color: colors.fg, fontFamily: "DMSans_700Bold", fontSize: 24, marginTop: 4 }}>
            {formatMoney(totalOwed)}
          </Text>
        </View>
        <View style={{ flex: 1, backgroundColor: colors.elevated, borderRadius: 16, padding: 16 }}>
          <Text style={{ color: colors.muted, fontFamily: "DMSans_400Regular" }}>Owed to you</Text>
          <Text style={{ color: colors.fg, fontFamily: "DMSans_700Bold", fontSize: 24, marginTop: 4 }}>
            {formatMoney(totalDue)}
          </Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} size="large" />
      ) : (
        <>
          <SectionLabel>Tap to pay</SectionLabel>
          {owed.length === 0 ? (
            <EmptyState message="You’re square. Nothing to pay." />
          ) : (
            owed.map((row) => (
              <ActionTile
                key={row.id}
                title={`${formatMoney(row.amount)} → ${row.to_profile?.display_name ?? "Player"}`}
                subtitle={
                  row.event?.title
                    ? `${row.event.title}${
                        row.to_profile?.venmo_username
                          ? ` · @${row.to_profile.venmo_username}`
                          : ""
                      }`
                    : undefined
                }
                meta={selected?.id === row.id ? "Selected" : "Select"}
                onPress={() => setSelected(row)}
              />
            ))
          )}

          <SectionLabel>Coming to you</SectionLabel>
          {owedToMe.length === 0 ? (
            <EmptyState message="Nobody owes you right now." />
          ) : (
            owedToMe.map((row) => (
              <ActionTile
                key={row.id}
                title={`${formatMoney(row.amount)} from ${row.from_profile?.display_name ?? "Player"}`}
                subtitle={row.event?.title ?? undefined}
              />
            ))
          )}
        </>
      )}
    </Screen>
  );
}
