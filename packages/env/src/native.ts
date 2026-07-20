import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

declare const process: {
  env: Record<string, string | undefined>;
};

const fallbackServerUrl = "https://rdm-hack-server.vercel.app";
const runtimeEnv = {
  EXPO_PUBLIC_PRIVY_APP_ID: process.env.EXPO_PUBLIC_PRIVY_APP_ID,
  EXPO_PUBLIC_PRIVY_CLIENT_ID: process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID,
  EXPO_PUBLIC_SERVER_URL: process.env.EXPO_PUBLIC_SERVER_URL ?? fallbackServerUrl,
};

export const env = createEnv({
  clientPrefix: "EXPO_PUBLIC_",
  client: {
    EXPO_PUBLIC_PRIVY_APP_ID: z.string().min(1),
    EXPO_PUBLIC_PRIVY_CLIENT_ID: z.string().min(1),
    EXPO_PUBLIC_SERVER_URL: z.url().transform((url) => url.replace(/\/$/, "")),
  },
  runtimeEnv,
  emptyStringAsUndefined: true,
});
