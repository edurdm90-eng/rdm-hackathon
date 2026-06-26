import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

const fallbackServerUrl = "https://rdm-hack-server.vercel.app";
const runtimeEnv = {
  ...(typeof process !== "undefined" ? process.env : {}),
  EXPO_PUBLIC_SERVER_URL:
    (typeof process !== "undefined" ? process.env?.EXPO_PUBLIC_SERVER_URL : undefined) ??
    fallbackServerUrl,
};

export const env = createEnv({
  clientPrefix: "EXPO_PUBLIC_",
  client: {
    EXPO_PUBLIC_SERVER_URL: z.url().transform((url) => url.replace(/\/$/, "")),
  },
  runtimeEnv,
  emptyStringAsUndefined: true,
});
