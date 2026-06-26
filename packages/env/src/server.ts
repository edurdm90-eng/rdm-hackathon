import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

declare const process: {
  env: Record<string, string | undefined>;
};

export const env = createEnv({
  clientPrefix: "",
  client: {},
  server: {
    DATABASE_URL: z.string().min(1),
    DATABASE_NAME: z.string().min(1).default("rdm-hack"),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
