import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text } from "react-native";

import {
  BrandTitle,
  Field,
  Heading,
  Muted,
  PrimaryButton,
  Screen,
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
    Alert.alert("Welcome", "Account created. You’re in.");
    router.replace("/(tabs)/home");
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView keyboardShouldPersistTaps="handled">
          <BrandTitle />
          <Heading>Join the crew</Heading>
          <Muted>Friendly wagers. Real standings. Your Venmo for payouts.</Muted>
          <Field label="Display name" value={displayName} onChangeText={setDisplayName} />
          <Field
            label="Venmo username"
            autoCapitalize="none"
            value={venmoUsername}
            onChangeText={setVenmoUsername}
            placeholder="john-smith"
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
          <PrimaryButton
            label={loading ? "Creating…" : "Create account"}
            onPress={onSubmit}
            disabled={loading}
          />
          <Link href="/(auth)/login" style={{ marginTop: 24 }}>
            <Text style={{ color: colors.accent, fontFamily: "DMSans_400Regular" }}>
              Already have an account?
            </Text>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
