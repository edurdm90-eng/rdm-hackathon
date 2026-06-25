import { Ionicons } from "@expo/vector-icons";
import { Stack, router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HACK_THEME as theme } from "@/lib/constants";

const rdmLogo = require("@/assets/logo/rdm-logo.png");

export default function Modal() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={["top", "right", "bottom", "left"]} style={styles.screen}>
        <View style={styles.header}>
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="contain"
            source={rdmLogo}
            style={styles.logo}
          />
          <Pressable
            accessibilityLabel="Close modal"
            accessibilityRole="button"
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Ionicons name="close-outline" size={22} color={theme.text} />
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.iconFrame}>
            <Ionicons name="sparkles-outline" size={26} color={theme.participant} />
          </View>
          <Text style={styles.eyebrow}>Native Surface</Text>
          <Text style={styles.title}>RDM Control Panel</Text>
          <Text style={styles.copy}>
            A focused native route for temporary actions, confirmations, and organizer utilities.
          </Text>

          <View style={styles.statusGrid}>
            <View style={styles.statusTile}>
              <Text style={styles.statusValue}>XRDM</Text>
              <Text style={styles.statusLabel}>Theme</Text>
            </View>
            <View style={styles.statusTile}>
              <Text style={styles.statusValue}>Live</Text>
              <Text style={styles.statusLabel}>Native</Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace("/")}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Ionicons name="home-outline" size={18} color="#03120C" />
            <Text style={styles.primaryButtonText}>Back Home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.panel,
    borderColor: theme.participantBorder,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
    margin: 16,
    padding: 18,
  },
  copy: {
    color: theme.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  eyebrow: {
    color: theme.participant,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2.4,
    textTransform: "uppercase",
  },
  header: {
    alignItems: "center",
    borderBottomColor: theme.borderSoft,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: theme.panelStrong,
    borderColor: theme.borderStrong,
    borderRadius: 14,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  iconFrame: {
    alignItems: "center",
    backgroundColor: theme.participantDark,
    borderColor: theme.participantBorder,
    borderRadius: 16,
    borderWidth: 1,
    height: 58,
    justifyContent: "center",
    width: 58,
  },
  logo: {
    height: 38,
    width: 112,
  },
  pressed: {
    opacity: 0.78,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: theme.participant,
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#03120C",
    fontSize: 14,
    fontWeight: "900",
  },
  screen: {
    backgroundColor: theme.background,
    flex: 1,
  },
  statusGrid: {
    flexDirection: "row",
    gap: 10,
  },
  statusLabel: {
    color: theme.dim,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  statusTile: {
    backgroundColor: theme.panelStrong,
    borderColor: theme.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    padding: 12,
  },
  statusValue: {
    color: theme.text,
    fontSize: 18,
    fontWeight: "900",
  },
  title: {
    color: theme.text,
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: 0,
  },
});
