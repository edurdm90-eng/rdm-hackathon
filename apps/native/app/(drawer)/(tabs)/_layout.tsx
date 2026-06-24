import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthenticatedTabs } from "@/components/hack-room";
import { HACK_THEME as theme } from "@/lib/constants";

type TabRouteName = "index" | "hack-room" | "profile";

type ElegantTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>>[0];

const tabIcons: Record<TabRouteName, React.ComponentProps<typeof Ionicons>["name"]> = {
  "hack-room": "flash-outline",
  index: "home-outline",
  profile: "person-circle-outline",
};

export default function TabLayout() {
  return (
    <AuthenticatedTabs>
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen name="hack-room" options={{ title: "Rooms" }} />
        <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      </Tabs>
    </AuthenticatedTabs>
  );
}

function TabBar({ descriptors, navigation, state }: ElegantTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.barWrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const options = descriptors[route.key]?.options;
          const label =
            typeof options?.tabBarLabel === "string"
              ? options.tabBarLabel
              : options?.title ?? route.name;
          const icon = tabIcons[route.name as TabRouteName] ?? "ellipse-outline";

          const onPress = () => {
            const event = navigation.emit({
              canPreventDefault: true,
              target: route.key,
              type: "tabPress",
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : undefined}
              key={route.key}
              onPress={onPress}
              style={({ pressed }) => [
                styles.tab,
                focused && styles.tabActive,
                pressed && styles.tabPressed,
              ]}
            >
              <Ionicons
                name={icon}
                size={focused ? 19 : 18}
                color={focused ? theme.text : theme.dim}
              />
              <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: theme.panel,
    borderColor: theme.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    minHeight: 58,
    padding: 5,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { height: 8, width: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 18,
      },
      default: { elevation: 8 },
    }),
  },
  barWrap: {
    backgroundColor: theme.background,
    paddingHorizontal: 14,
    paddingTop: 7,
  },
  label: {
    color: theme.dim,
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0,
    marginTop: 1,
  },
  labelActive: {
    color: theme.text,
    fontWeight: "800",
  },
  tab: {
    alignItems: "center",
    borderRadius: 14,
    flex: 1,
    gap: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingVertical: 5,
  },
  tabActive: {
    backgroundColor: theme.panelStrong,
    borderColor: theme.border,
    borderWidth: 1,
  },
  tabPressed: {
    opacity: 0.7,
  },
});
