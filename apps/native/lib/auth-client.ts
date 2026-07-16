import { expoClient } from "@better-auth/expo/client";
import { privyClient } from "@rdm-hack/auth/client";
import { env } from "@rdm-hack/env/native";
import { createAuthClient } from "better-auth/react";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

const appScheme = (Constants.expoConfig?.scheme as string | undefined) ?? "rdm-hack";

export const authClient = createAuthClient({
  baseURL: env.EXPO_PUBLIC_SERVER_URL,
  plugins: [
    expoClient({
      scheme: appScheme,
      storagePrefix: appScheme,
      storage: SecureStore,
    }),
    privyClient(),
  ],
});
