import * as Linking from "expo-linking";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import {
  BrandTitle,
  ListRow,
  ListSection,
  Muted,
  Screen,
  SectionTitle,
} from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { colors, spacing } from "@/lib/theme";
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
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.push("/(tabs)/home")}>
          <BrandTitle size="md" />
        </Pressable>
        <Muted>
          {venmo ? `Venmo @${venmo}` : "Add Venmo on the web app if missing."}
        </Muted>

        <View
          style={{
            flexDirection: "row",
            gap: 24,
            marginTop: 32,
            paddingBottom: 8,
            borderBottomWidth: StyleSheetHairline,
            borderBottomColor: colors.line,
          }}
        >
          <View>
            <Text style={statLabel}>You owe</Text>
            <Text style={statValue}>{formatMoney(totalOwed)}</Text>
          </View>
          <View>
            <Text style={statLabel}>Owed to you</Text>
            <Text style={statValue}>{formatMoney(totalDue)}</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 48 }} />
        ) : (
          <>
            <SectionTitle>You owe</SectionTitle>
            {owed.length === 0 ? (
              <Muted>You’re square.</Muted>
            ) : (
              <ListSection>
                {owed.map((row, i) => (
                  <View key={row.id}>
                    <ListRow
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
                      isFirst={i === 0}
                      isLast={i === owed.length - 1}
                    />
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 16,
                        paddingBottom: 12,
                        marginTop: -4,
                      }}
                    >
                      <Pressable onPress={() => void payOnVenmo(row)}>
                        <Text style={{ color: colors.accent, fontFamily: "DMSans_700Bold", fontSize: 14 }}>
                          Pay on Venmo
                        </Text>
                      </Pressable>
                      <Pressable onPress={() => void markPaid(row.id)}>
                        <Text style={{ color: colors.muted, fontFamily: "DMSans_700Bold", fontSize: 14 }}>
                          Mark paid
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </ListSection>
            )}

            <SectionTitle>Owed to you</SectionTitle>
            {owedToMe.length === 0 ? (
              <Muted>Nobody owes you right now.</Muted>
            ) : (
              <ListSection>
                {owedToMe.map((row, i) => (
                  <ListRow
                    key={row.id}
                    title={`${formatMoney(row.amount)} from ${row.from_profile?.display_name ?? "Player"}`}
                    subtitle={row.event?.title ?? undefined}
                    isFirst={i === 0}
                    isLast={i === owedToMe.length - 1}
                  />
                ))}
              </ListSection>
            )}
            <View style={{ height: spacing.xl }} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const StyleSheetHairline = 1 / 2;

const statLabel = {
  fontFamily: "DMSans_400Regular" as const,
  fontSize: 13,
  color: colors.muted,
};
const statValue = {
  fontFamily: "DMSans_700Bold" as const,
  fontSize: 22,
  color: colors.fg,
  marginTop: 4,
};
