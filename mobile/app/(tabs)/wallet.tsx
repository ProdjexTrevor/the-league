import * as Linking from "expo-linking";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";

import { BrandTitle, Card, Heading, Muted, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { colors, spacing } from "@/lib/theme";
import { formatMoney, venmoPayUrl } from "@/lib/venmo";

type Obligation = {
  id: string;
  amount: number;
  status: string;
  to_user_id: string;
  from_user_id: string;
  event_id: string;
  to_profile?: { display_name: string | null; venmo_username: string | null } | null;
  from_profile?: { display_name: string | null; venmo_username: string | null } | null;
  event?: { title: string | null } | null;
};

export default function WalletScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [owed, setOwed] = useState<Obligation[]>([]);
  const [owedToMe, setOwedToMe] = useState<Obligation[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("wallet_obligations")
      .select(
        "id, amount, status, to_user_id, from_user_id, event_id, events(title)"
      )
      .eq("status", "open")
      .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`);

    if (error) {
      setLoading(false);
      Alert.alert("Wallet error", error.message);
      return;
    }

    const rows = data ?? [];
    const userIds = Array.from(
      new Set(rows.flatMap((r) => [r.from_user_id, r.to_user_id]))
    );
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, venmo_username")
      .in("id", userIds);
    const byId = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

    const enriched = rows.map((r) => ({
      ...r,
      amount: Number(r.amount),
      to_profile: byId[r.to_user_id],
      from_profile: byId[r.from_user_id],
      event: Array.isArray(r.events) ? r.events[0] : r.events,
    })) as Obligation[];

    setOwed(enriched.filter((r) => r.from_user_id === user.id));
    setOwedToMe(enriched.filter((r) => r.to_user_id === user.id));
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
    const url = venmoPayUrl({
      username,
      amount: row.amount,
      note: row.event?.title ?? "The League",
    });
    await Linking.openURL(url);
  }

  return (
    <Screen style={{ paddingTop: spacing.xl + 8 }}>
      <ScrollView>
        <BrandTitle />
        <Heading>Wallet</Heading>
        <Muted>What you owe after settled games — pay on Venmo, then mark paid.</Muted>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />
        ) : (
          <>
            <Heading>You owe</Heading>
            {owed.length === 0 ? (
              <Muted>You’re square.</Muted>
            ) : (
              owed.map((row) => (
                <Card key={row.id}>
                  <Text style={{ color: colors.fg, fontFamily: "DMSans_700Bold", fontSize: 16 }}>
                    {formatMoney(row.amount)} → {row.to_profile?.display_name ?? "Player"}
                  </Text>
                  <Text style={{ color: colors.muted, marginTop: 4, fontFamily: "DMSans_400Regular" }}>
                    {row.event?.title ?? "Event"}
                    {row.to_profile?.venmo_username
                      ? ` · @${row.to_profile.venmo_username}`
                      : ""}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 16, marginTop: 12 }}>
                    <Pressable onPress={() => void payOnVenmo(row)}>
                      <Text style={{ color: colors.accent, fontFamily: "DMSans_700Bold" }}>
                        Pay on Venmo
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => void markPaid(row.id)}>
                      <Text style={{ color: colors.muted, fontFamily: "DMSans_700Bold" }}>
                        Mark paid
                      </Text>
                    </Pressable>
                  </View>
                </Card>
              ))
            )}

            <Heading>Owed to you</Heading>
            {owedToMe.length === 0 ? (
              <Muted>Nobody owes you right now.</Muted>
            ) : (
              owedToMe.map((row) => (
                <Card key={row.id}>
                  <Text style={{ color: colors.fg, fontFamily: "DMSans_700Bold", fontSize: 16 }}>
                    {formatMoney(row.amount)} from {row.from_profile?.display_name ?? "Player"}
                  </Text>
                  <Text style={{ color: colors.muted, marginTop: 4, fontFamily: "DMSans_400Regular" }}>
                    {row.event?.title ?? "Event"}
                  </Text>
                </Card>
              ))
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
