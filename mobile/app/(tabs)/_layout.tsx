import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/lib/theme";

const TAB_BAR_CONTENT_HEIGHT = 56;

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text
      style={{
        fontFamily: focused ? "DMSans_700Bold" : "DMSans_400Regular",
        fontSize: 12,
        color: focused ? colors.accent : colors.muted,
      }}
    >
      {label}
    </Text>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  // Fixed height alone overrides React Navigation's safe-area padding and
  // clips the tab menu under the home indicator on modern iPhones.
  const bottomInset = Math.max(insets.bottom, 0);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.line,
          borderTopWidth: 1,
          height: TAB_BAR_CONTENT_HEIGHT + bottomInset,
          paddingTop: 6,
          paddingBottom: bottomInset,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarLabel: ({ focused }) => <TabLabel label="Home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "Create",
          tabBarLabel: ({ focused }) => <TabLabel label="Create" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: "Wallet",
          tabBarLabel: ({ focused }) => <TabLabel label="Wallet" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
