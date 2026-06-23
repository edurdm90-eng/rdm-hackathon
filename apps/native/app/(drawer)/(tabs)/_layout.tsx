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
        tabBar={(props) => <ElegantTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
          }}
        />
        <Tabs.Screen
          name="hack-room"
          options={{
            title: "Hack Room",
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
          }}
        />
      </Tabs>
    </AuthenticatedTabs>
  );
}

function ElegantTabBar({ descriptors, navigation, state }: ElegantTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 12);

  return (
    <View style={[styles.navWrap, { paddingBottom: bottomInset }]}>
      <View style={styles.navPill}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const options = descriptors[route.key]?.options;
          const label =
            typeof options?.tabBarLabel === "string"
              ? options.tabBarLabel
              : options?.title ?? route.name;
          const icon = tabIcons[route.name as TabRouteName] ?? "ellipse-outline";
          const color = focused ? theme.participant : theme.muted;

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
                styles.navItem,
                focused && styles.navItemActive,
                pressed && styles.navItemPressed,
              ]}
            >
              <View style={[styles.iconShell, focused && styles.iconShellActive]}>
                <Ionicons name={icon} size={focused ? 17 : 16} color={color} />
              </View>
              <Text
                numberOfLines={1}
                style={[styles.navLabel, focused && styles.navLabelActive]}
              >
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
  iconShell: {
    alignItems: "center",
    height: 20,
    justifyContent: "center",
    width: 24,
  },
  iconShellActive: {
    backgroundColor: "rgba(255, 255, 255, 0.10)",
    borderColor: theme.participantBorder,
    borderRadius: 8,
    borderWidth: 1,
    height: 28,
    width: 36,
  },
  navItem: {
    alignItems: "center",
    borderRadius: 18,
    flex: 1,
    gap: 2,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 4,
    paddingVertical: 5,
  },
  navItemActive: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  navItemPressed: {
    opacity: 0.74,
  },
  navLabel: {
    color: theme.muted,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  navLabelActive: {
    color: theme.participant,
    fontWeight: "700",
  },
  navPill: {
    alignItems: "center",
    backgroundColor: theme.panel,
    borderColor: theme.borderSoft,
    borderRadius: 26,
    borderWidth: 1,
    flexDirection: "row",
    gap: 3,
    minHeight: 54,
    padding: 5,
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { height: 6, width: 0 },
        shadowOpacity: 0.26,
        shadowRadius: 18,
      },
      default: {
        elevation: 10,
      },
    }),
  },
  navWrap: {
    paddingHorizontal: 16,
    paddingTop: 6,
  },
});
