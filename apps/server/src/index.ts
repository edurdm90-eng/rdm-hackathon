import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { createContext } from "../../../packages/api/src/context.js";
import { appRouter } from "../../../packages/api/src/routers/index.js";
import { auth } from "../../../packages/auth/src/index.js";
import { client } from "../../../packages/db/src/index.js";
import { env } from "../../../packages/env/src/server.js";

const app = new Hono();
const allowedOrigins = new Set(env.CORS_ORIGIN);

function resolveCorsOrigin(origin: string) {
  if (allowedOrigins.has("*")) {
    return origin;
  }

  if (allowedOrigins.has(origin)) {
    return origin;
  }

  return null;
}

function getCorsOrigin(c: { req: { header: (name: string) => string | undefined } }) {
  const origin = c.req.header("Origin");

  if (!origin) {
    return null;
  }

  return resolveCorsOrigin(origin);
}

function withCorsHeaders(c: { req: { header: (name: string) => string | undefined } }, response: Response) {
  const corsOrigin = getCorsOrigin(c);

  if (!corsOrigin) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", corsOrigin);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

  const vary = headers.get("Vary");
  if (!vary?.toLowerCase().split(",").map((value) => value.trim()).includes("origin")) {
    headers.set("Vary", vary ? `${vary}, Origin` : "Origin");
  }

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

app.use(logger());
app.use(
  "/*",
  cors({
    origin: resolveCorsOrigin,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.on(["POST", "GET"], "/api/auth/*", async (c) => {
  const response = await auth.handler(c.req.raw);
  return withCorsHeaders(c, response);
});

app.get("/metadata/hack-rewards/:rewardId.json", async (c) => {
  const rewardId = c.req.param("rewardId");

  if (!rewardId) {
    return c.json({ error: "Reward metadata not found" }, 404);
  }

  const reward = await client.collection<{
    _id: string;
    awardXrdm?: number;
    description?: string;
    kind: string;
    recipients?: unknown;
    teamName?: string;
    title?: string;
  }>("hack_rewards").findOne({
    _id: rewardId,
    kind: "winner_nft_badge",
  });

  if (!reward) {
    return c.json({ error: "Reward metadata not found" }, 404);
  }

  const recipients = Array.isArray(reward.recipients) ? reward.recipients : [];

  return c.json({
    attributes: [
      {
        trait_type: "Room",
        value: reward.teamName ?? "Hack room",
      },
      {
        trait_type: "Reward Kind",
        value: "Winner NFT Badge",
      },
      {
        trait_type: "XRDM Attached",
        value: reward.awardXrdm ?? 0,
      },
      {
        trait_type: "Recipients",
        value: recipients.length,
      },
    ],
    description:
      reward.description ||
      `Winner NFT badge issued for ${reward.teamName ?? "an RDM Hack Room"}.`,
    external_url: new URL(`/metadata/hack-rewards/${rewardId}.json`, env.BETTER_AUTH_URL).toString(),
    name: reward.title ?? "Winner NFT Badge",
  });
});

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_opts, context) => {
      return createContext({ context });
    },
  }),
);

app.get("/", (c) => {
  return c.text("OK");
});

export default app;
