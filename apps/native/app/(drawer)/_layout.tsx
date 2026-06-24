import { Ionicons } from "@expo/vector-icons";
import { Drawer } from "expo-router/drawer";
import type React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { HACK_THEME as hackTheme, NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

const rdmLogo = require("@/assets/logo/rdm-logo.png");

type DrawerContentProps = Parameters<NonNullable<React.ComponentProps<typeof Drawer>["drawerContent"]>>[0];
type TabTarget = "hack-room" | "index" | "profile";

const DrawerLayout = () => {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <Drawer
      drawerContent={(props) => <XrdmDrawerContent {...props} />}
      initialRouteName="(tabs)"
      screenOptions={{
        headerShown: false,
        headerStyle: {
          backgroundColor: theme.background,
        },
        headerTitleStyle: {
          color: theme.text,
        },
        headerTintColor: theme.text,
        drawerStyle: {
          backgroundColor: theme.background,
        },
        drawerActiveBackgroundColor: theme.card,
        drawerActiveTintColor: theme.primary,
        drawerInactiveTintColor: theme.text,
        drawerLabelStyle: {
          color: theme.text,
          fontWeight: "700",
        },
        sceneStyle: {
          backgroundColor: theme.background,
        },
      }}
    >
      <Drawer.Screen
        name="(tabs)"
        options={{
          headerTitle: "Home",
          drawerLabel: "Home",
          drawerIcon: ({ size, color }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="index"
        options={{
          drawerItemStyle: { display: "none" },
          headerShown: false,
        }}
      />
    </Drawer>
  );
};

function XrdmDrawerContent({ navigation }: DrawerContentProps) {
  const navigateTo = (screen: TabTarget) => {
    (
      navigation as {
        closeDrawer?: () => void;
        navigate: (route: string, params?: { screen: TabTarget }) => void;
      }
    ).navigate("(tabs)", { screen });
    (navigation as { closeDrawer?: () => void }).closeDrawer?.();
  };

  return (
    <View style={styles.drawer}>
      <View style={styles.drawerBrand}>
        <Image accessibilityIgnoresInvertColors source={rdmLogo} style={styles.drawerLogo} />
        <Text style={styles.drawerEyebrow}>Hack Room</Text>
        <Text style={styles.drawerTitle}>RDM Command</Text>
      </View>

      <View style={styles.drawerNav}>
        <DrawerLink
          icon="home-outline"
          label="Home"
          onPress={() => navigateTo("index")}
          tone="cyan"
        />
        <DrawerLink
          icon="flash-outline"
          label="Hack Rooms"
          onPress={() => navigateTo("hack-room")}
          tone="violet"
        />
        <DrawerLink
          icon="person-circle-outline"
          label="Profile"
          onPress={() => navigateTo("profile")}
          tone="gold"
        />
      </View>

      <View style={styles.drawerFooter}>
        <Ionicons name="shield-checkmark-outline" size={18} color={hackTheme.participant} />
        <Text style={styles.drawerFooterText}>Organizer and participant flows stay in sync.</Text>
      </View>
    </View>
  );
}

function DrawerLink({
  icon,
  label,
  onPress,
  tone,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  tone: "cyan" | "gold" | "violet";
}) {
  const color =
    tone === "violet" ? hackTheme.host : tone === "gold" ? hackTheme.award : hackTheme.participant;
  const background =
    tone === "violet"
      ? hackTheme.hostDark
      : tone === "gold"
        ? hackTheme.awardDark
        : hackTheme.participantDark;
  const border =
    tone === "violet"
      ? hackTheme.hostBorder
      : tone === "gold"
        ? hackTheme.awardBorder
        : hackTheme.participantBorder;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.drawerLink,
        { backgroundColor: background, borderColor: border },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={19} color={color} />
      <Text style={[styles.drawerLinkText, { color }]}>{label}</Text>
      <Ionicons name="chevron-forward-outline" size={16} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  drawer: {
    backgroundColor: hackTheme.background,
    flex: 1,
    gap: 18,
    padding: 18,
    paddingTop: 54,
  },
  drawerBrand: {
    backgroundColor: hackTheme.panel,
    borderColor: hackTheme.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  drawerEyebrow: {
    color: hackTheme.participant,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2.2,
    textTransform: "uppercase",
  },
  drawerFooter: {
    alignItems: "center",
    backgroundColor: hackTheme.panelStrong,
    borderColor: hackTheme.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginTop: "auto",
    padding: 14,
  },
  drawerFooterText: {
    color: hackTheme.muted,
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  drawerLink: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  drawerLinkText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "900",
  },
  drawerLogo: {
    height: 34,
    resizeMode: "contain",
    width: 104,
  },
  drawerNav: {
    gap: 10,
  },
  drawerTitle: {
    color: hackTheme.text,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0,
  },
  pressed: {
    opacity: 0.78,
  },
});

export default DrawerLayout;
