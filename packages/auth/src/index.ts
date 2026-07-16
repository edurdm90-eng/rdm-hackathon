import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";

import { client } from "../../db/src/index.js";
import { env } from "../../env/src/server.js";
import { privyBridge } from "./privy-plugin.js";

export function createAuth() {
  return betterAuth({
    database: mongodbAdapter(client),
    trustedOrigins: [
      ...env.CORS_ORIGIN,
      "rdm-hack://",
      "exp://",
      "exp://**",
      "exp://*.exp.direct",
      "http://localhost:8081",
      "http://127.0.0.1:8081",
    ],
    emailAndPassword: {
      enabled: true,
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
        httpOnly: true,
      },
    },
    plugins: [expo(), privyBridge()],
  });
}

export const auth = createAuth();
