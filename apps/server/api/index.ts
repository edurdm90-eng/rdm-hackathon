import { handle } from "@hono/node-server/vercel";
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "node:http";

import { auth } from "../../../packages/auth/src/index.js";
import app from "../src/index.js";

const DIRECT_AUTH_EXCHANGE_TIMEOUT_MS = 18_000;

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

type AuthHandlerResponse = {
  arrayBuffer: () => Promise<ArrayBuffer>;
  headers: {
    forEach: (callback: (value: string, key: string) => void) => void;
    get: (key: string) => string | null;
    getSetCookie?: () => string[];
  };
  status: number;
};

function withResponseTimeout(responsePromise: Promise<unknown>) {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  return Promise.race([
    responsePromise as Promise<AuthHandlerResponse>,
    new Promise<AuthHandlerResponse>((resolve) => {
      timeout = setTimeout(() => {
        resolve(
          Response.json(
            {
              code: "PRIVY_EXCHANGE_TIMEOUT",
              message: "Privy session exchange timed out. Please try again.",
            },
            { status: 503 },
          ) as AuthHandlerResponse,
        );
      }, DIRECT_AUTH_EXCHANGE_TIMEOUT_MS);
    }),
  ]).finally(() => {
    if (timeout) {
      clearTimeout(timeout);
    }
  });
}

async function sendWebResponse(res: ServerResponse, response: AuthHandlerResponse) {
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

async function handlePrivyExchange(req: VercelRequest, res: ServerResponse) {
  const host = req.headers.host ?? "localhost";
  const protocol = req.headers["x-forwarded-proto"] ?? "https";
  const request = new Request(`${protocol}://${host}${req.url ?? ""}`, {
    body: await readRequestBody(req),
    headers: copyHeaders(req.headers),
    method: req.method,
  });
  const response = await withResponseTimeout(auth.handler(request));

  await sendWebResponse(res, response);
}

export default async function handler(req: VercelRequest, res: ServerResponse) {
  if (isPrivyExchangeRequest(req)) {
    await handlePrivyExchange(req, res);
    return;
  }

  return honoHandler(req, res);
}
