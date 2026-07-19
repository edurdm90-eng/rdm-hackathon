import { handle } from "@hono/node-server/vercel";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "node:http";

import { appRouter } from "../../../packages/api/src/routers/index.js";
import { auth } from "../../../packages/auth/src/index.js";
import app from "../src/index.js";

const DIRECT_AUTH_EXCHANGE_TIMEOUT_MS = 18_000;
const DIRECT_TRPC_TIMEOUT_MS = 18_000;

export const config = {
  api: {
    bodyParser: false,
  },
};

const honoHandler = handle(app);

type VercelRequest = IncomingMessage & {
  body?: unknown;
};

function isPrivyExchangeRequest(req: VercelRequest) {
  if (req.method !== "POST" || !req.url) {
    return false;
  }

  return new URL(req.url, "http://localhost").pathname === "/api/auth/privy/exchange";
}

function isTrpcRequest(req: VercelRequest) {
  if (!req.url) {
    return false;
  }

  const pathname = new URL(req.url, "http://localhost").pathname;

  return pathname === "/trpc" || pathname.startsWith("/trpc/");
}

function requestCanHaveBody(method: string | undefined) {
  return method !== "GET" && method !== "HEAD";
}

function copyHeaders(source: IncomingHttpHeaders) {
  const headers = new Headers();

  for (const [key, value] of Object.entries(source)) {
    if (!value || key.toLowerCase() === "content-length") {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
    } else {
      headers.set(key, value);
    }
  }

  return headers;
}

async function readRequestBody(req: VercelRequest) {
  if (typeof req.body === "string" || Buffer.isBuffer(req.body)) {
    return req.body;
  }

  if (req.body && typeof req.body === "object") {
    return JSON.stringify(req.body);
  }

  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

type WebHandlerResponse = {
  arrayBuffer: () => Promise<ArrayBuffer>;
  headers: {
    forEach: (callback: (value: string, key: string) => void) => void;
    get: (key: string) => string | null;
    getSetCookie?: () => string[];
  };
  status: number;
};

function withResponseTimeout(
  responsePromise: Promise<unknown>,
  input: {
    code: string;
    message: string;
    status: number;
    timeoutMs: number;
  },
) {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  return Promise.race([
    responsePromise as Promise<WebHandlerResponse>,
    new Promise<WebHandlerResponse>((resolve) => {
      timeout = setTimeout(() => {
        resolve(
          Response.json(
            {
              code: input.code,
              message: input.message,
            },
            { status: input.status },
          ) as WebHandlerResponse,
        );
      }, input.timeoutMs);
    }),
  ]).finally(() => {
    if (timeout) {
      clearTimeout(timeout);
    }
  });
}

async function sendWebResponse(res: ServerResponse, response: WebHandlerResponse) {
  res.statusCode = response.status;

  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];

  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") {
      res.setHeader(key, value);
    }
  });

  if (setCookies.length > 0) {
    res.setHeader("set-cookie", setCookies);
  } else {
    const setCookie = response.headers.get("set-cookie");

    if (setCookie) {
      res.setHeader("set-cookie", setCookie);
    }
  }

  res.end(Buffer.from(await response.arrayBuffer()));
}

async function buildWebRequest(req: VercelRequest) {
  const host = req.headers.host ?? "localhost";
  const protocol = req.headers["x-forwarded-proto"] ?? "https";
  const method = req.method ?? "GET";
  const init: {
    body?: Buffer | string;
    headers: Headers;
    method: string;
  } = {
    headers: copyHeaders(req.headers),
    method,
  };

  if (requestCanHaveBody(method)) {
    init.body = await readRequestBody(req);
  }

  return new Request(`${protocol}://${host}${req.url ?? ""}`, init as never);
}

async function handlePrivyExchange(req: VercelRequest, res: ServerResponse) {
  const request = await buildWebRequest(req);
  const response = await withResponseTimeout(auth.handler(request), {
    code: "PRIVY_EXCHANGE_TIMEOUT",
    message: "Privy session exchange timed out. Please try again.",
    status: 503,
    timeoutMs: DIRECT_AUTH_EXCHANGE_TIMEOUT_MS,
  });

  await sendWebResponse(res, response);
}

async function handleTrpc(req: VercelRequest, res: ServerResponse) {
  const startedAt = Date.now();
  const request = await buildWebRequest(req);
  const path = new URL(request.url).pathname.replace(/^\/trpc\/?/, "");

  console.log("[server.trpc] direct request", {
    method: req.method,
    path,
  });

  const response = await withResponseTimeout(
    fetchRequestHandler({
      createContext: async () => ({
        auth: null,
        session: await auth.api.getSession({
          headers: request.headers,
        }),
      }),
      endpoint: "/trpc",
      req: request,
      router: appRouter,
    }),
    {
      code: "TRPC_TIMEOUT",
      message: "Request timed out. Please try again.",
      status: 503,
      timeoutMs: DIRECT_TRPC_TIMEOUT_MS,
    },
  );

  console.log("[server.trpc] direct response", {
    durationMs: Date.now() - startedAt,
    path,
    status: response.status,
  });

  await sendWebResponse(res, response);
}

export default async function handler(req: VercelRequest, res: ServerResponse) {
  if (isPrivyExchangeRequest(req)) {
    await handlePrivyExchange(req, res);
    return;
  }

  if (isTrpcRequest(req)) {
    await handleTrpc(req, res);
    return;
  }

  return honoHandler(req, res);
}
