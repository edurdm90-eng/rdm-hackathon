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

function normalizeEmailList(value: string) {
  return [
    ...new Set(
      value
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
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
    ADMIN_ALLOWED_EMAILS: z
      .string()
      .default("")
      .transform(normalizeEmailList)
      .pipe(z.array(z.email())),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PRIVY_APP_ID: z.string().min(1),
    PRIVY_APP_SECRET: z.string().min(1),
    PRIVY_JWT_VERIFICATION_KEY: z.string().min(1),
  },
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
