import { Ionicons } from "@expo/vector-icons";
import { Stack, router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HACK_THEME as theme } from "@/lib/constants";

const rdmLogo = require("@/assets/logo/rdm-logo.png");

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: "Not Found" }} />
      <SafeAreaView edges={["top", "right", "bottom", "left"]} style={styles.screen}>
        <View style={styles.header}>
          <Image accessibilityIgnoresInvertColors source={rdmLogo} style={styles.logo} />
        </View>

        <View style={styles.card}>
          <View style={styles.alertIcon}>
            <Ionicons name="alert-circle-outline" size={28} color={theme.danger} />
          </View>
          <Text style={styles.eyebrow}>Route Missing</Text>
          <Text style={styles.title}>Page Not Found</Text>
          <Text style={styles.copy}>
            This native screen is not available. Head back to your room hub and keep the sprint moving.
          </Text>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace("/")}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <Ionicons name="home-outline" size={18} color="#03120C" />
              <Text style={styles.primaryButtonText}>Home</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace("/hack-room")}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Ionicons name="flash-outline" size={18} color={theme.host} />
              <Text style={styles.secondaryButtonText}>Hack Rooms</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  alertIcon: {
    alignItems: "center",
    backgroundColor: theme.dangerDark,
    borderColor: theme.dangerBorder,
    borderRadius: 16,
    borderWidth: 1,
    height: 58,
    justifyContent: "center",
    width: 58,
  },
  card: {
    backgroundColor: theme.dangerDark,
    borderColor: theme.dangerBorder,
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
    color: theme.danger,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2.4,
    textTransform: "uppercase",
  },
  header: {
    borderBottomColor: theme.borderSoft,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  logo: {
    height: 38,
    resizeMode: "contain",
    width: 112,
  },
  pressed: {
    opacity: 0.78,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: theme.participant,
    borderRadius: 12,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 48,
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
  secondaryButton: {
    alignItems: "center",
    backgroundColor: theme.hostDark,
    borderColor: theme.hostBorder,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 48,
  },
  secondaryButtonText: {
    color: theme.host,
    fontSize: 14,
    fontWeight: "900",
  },
  title: {
    color: theme.text,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 0,
  },
});
