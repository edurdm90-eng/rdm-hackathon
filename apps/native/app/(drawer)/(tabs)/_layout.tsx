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
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
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
            style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
          >
            {focused && <View style={styles.activeBar} />}
            <Ionicons
              name={icon}
              size={22}
              color={focused ? theme.text : theme.dim}
            />
            <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  activeBar: {
    backgroundColor: theme.text,
    borderRadius: 2,
    height: 2,
    position: "absolute",
    top: 0,
    width: 24,
  },
  bar: {
    backgroundColor: theme.panel,
    borderTopColor: theme.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { height: -2, width: 0 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
      default: { elevation: 8 },
    }),
  },
  label: {
    color: theme.dim,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.2,
    marginTop: 2,
  },
  labelActive: {
    color: theme.text,
    fontWeight: "700",
  },
  tab: {
    alignItems: "center",
    flex: 1,
    gap: 2,
    justifyContent: "center",
    paddingBottom: 4,
    paddingTop: 10,
  },
  tabPressed: {
    opacity: 0.6,
  },
});
