import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

declare const process: {
  env: Record<string, string | undefined>;
};

function normalizeOrigin(origin: string) {
  const value = origin.trim().replace(/\/$/, "");

  if (
    value === "*" ||
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("exp://") ||
    value.startsWith("rdm-hack://")
  ) {
    return value;
  }

  if (
    value.startsWith("localhost") ||
    value.startsWith("127.") ||
    value.startsWith("192.168.") ||
    value.startsWith("10.")
  ) {
    return `http://${value}`;
  }

  return `https://${value}`;
}

function normalizeOriginList(value: string) {
  return value
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);
}

export const env = createEnv({
  clientPrefix: "",
  client: {},
  server: {
    DATABASE_URL: z.string().min(1),
    DATABASE_NAME: z.string().min(1).default("rdm-hack"),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.string().min(1).transform(normalizeOriginList),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
