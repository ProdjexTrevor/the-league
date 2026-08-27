import { BebasNeue_400Regular } from "@expo-google-fonts/bebas-neue";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
  useFonts,
} from "@expo-google-fonts/dm-sans";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PaperProvider } from "react-native-paper";

import { AuthProvider, useAuth } from "@/lib/auth";
import { paperTheme } from "@/lib/paper-theme";
import { colors } from "@/lib/theme";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === "(auth)";
    if (!session && !inAuth) {
      router.replace("/(auth)/login");
    } else if (session && inAuth) {
      router.replace("/(tabs)/home");
    }
  }, [session, loading, segments, router]);

  if (loading) {
    return (
      <View style={center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

const center = {
  flex: 1,
  backgroundColor: colors.bg,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BebasNeue_400Regular,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider
        theme={paperTheme}
        settings={{
          icon: ({ name, color, size }) => (
            <MaterialCommunityIcons name={name as never} color={color} size={size} />
          ),
        }}
      >
        <AuthProvider>
          <StatusBar style="light" />
          <AuthGate>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg },
                animation: "slide_from_right",
              }}
            />
          </AuthGate>
        </AuthProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
