import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { Text } from "react-native-paper";

import {
  BigButton,
  BrandMark,
  Field,
  PageTitle,
  Screen,
  Subtle,
} from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";
import { normalizeVenmoUsername } from "@/lib/venmo";

export default function SignupScreen() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [venmoUsername, setVenmoUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    const venmo = normalizeVenmoUsername(venmoUsername);
    if (!venmo || !/^[a-z0-9_-]{3,30}$/i.test(venmo)) {
      Alert.alert("Venmo required", "Enter your Venmo username (e.g. john-smith).");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName.trim() || email.split("@")[0],
          venmo_username: venmo,
        },
      },
    });
    setLoading(false);
    if (error) {
      Alert.alert("Sign up failed", error.message);
      return;
    }
    router.replace("/(tabs)/home");
  }

  return (
    <Screen
      bottomBar={
        <BigButton
          label={loading ? "Creating…" : "Create account"}
          onPress={onSubmit}
          loading={loading}
          disabled={loading}
          icon="account-plus"
        />
      }
    >
      <View style={{ paddingTop: 12 }}>
        <BrandMark />
        <PageTitle>Join the crew</PageTitle>
        <Subtle>Friendly wagers. Real standings. Venmo for payouts.</Subtle>
        <Field label="Display name" value={displayName} onChangeText={setDisplayName} />
        <Field
          label="Venmo username"
          autoCapitalize="none"
          value={venmoUsername}
          onChangeText={setVenmoUsername}
        />
        <Field
          label="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Field
          label="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <Link href="/(auth)/login" style={{ marginTop: 20 }}>
          <Text style={{ color: colors.muted }}>
            Already have an account? <Text style={{ color: colors.accent }}>Log in</Text>
          </Text>
        </Link>
      </View>
    </Screen>
  );
}
