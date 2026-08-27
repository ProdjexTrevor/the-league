import { Link } from "expo-router";
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

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setLoading(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      Alert.alert("Sign in failed", signInError.message);
    }
  }

  return (
    <Screen
      bottomBar={
        <BigButton
          label={loading ? "Signing in…" : "Log in"}
          onPress={onSubmit}
          loading={loading}
          disabled={loading || !email || !password}
          icon="login"
        />
      }
    >
      <View style={{ paddingTop: 24 }}>
        <BrandMark />
        <PageTitle>Log in</PageTitle>
        <Subtle>Pick up where your standings left off.</Subtle>
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
        {error ? (
          <Text style={{ color: colors.danger, marginTop: 8 }}>{error}</Text>
        ) : null}
        <Link href="/(auth)/signup" style={{ marginTop: 20 }}>
          <Text style={{ color: colors.muted }}>
            New here? <Text style={{ color: colors.accent }}>Create an account</Text>
          </Text>
        </Link>
      </View>
    </Screen>
  );
}
