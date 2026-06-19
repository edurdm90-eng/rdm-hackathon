import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthenticatedTabs } from "@/components/hack-room";
import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

export default function TabLayout() {
  const { isDarkColorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const theme = isDarkColorScheme ? NAV_THEME.dark : NAV_THEME.light;
  const bottomPadding = Math.max(insets.bottom, 12);

  return (
    <AuthenticatedTabs>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.primary,
          tabBarInactiveTintColor: "#626058",
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "700",
          },
          tabBarStyle: {
            backgroundColor: theme.background,
            borderTopColor: theme.border,
            height: 56 + bottomPadding,
            paddingBottom: bottomPadding,
            paddingTop: 8,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="hack-room"
          options={{
            title: "Hack Room",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="flash-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-circle-outline" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </AuthenticatedTabs>
  );
}
