import { Link } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";

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
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingVertical: 24,
            maxWidth: 420,
            width: "100%",
            alignSelf: "center",
          }}
        >
          <BrandTitle size="lg" />
          <Heading>Log in</Heading>
          <Muted>Pick up where your standings left off.</Muted>
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
            <Text
              style={{
                color: colors.danger,
                marginTop: 12,
                fontFamily: "DMSans_400Regular",
                fontSize: 14,
              }}
            >
              {error}
            </Text>
          ) : null}
          <PrimaryButton
            label={loading ? "Signing in…" : "Log in"}
            onPress={onSubmit}
            disabled={loading || !email || !password}
            style={{ marginTop: 24, alignSelf: "stretch" }}
          />
          <View style={{ marginTop: 24 }}>
            <Link href="/(auth)/signup">
              <Text style={{ color: colors.muted, fontFamily: "DMSans_400Regular", fontSize: 14 }}>
                New here?{" "}
                <Text style={{ color: colors.accent }}>Create an account</Text>
              </Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
