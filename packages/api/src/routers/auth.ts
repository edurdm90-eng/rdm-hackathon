import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  LOGIN_RESTRICTION_BLOCK_CODE,
  LOGIN_RESTRICTION_BLOCK_MESSAGE,
  normalizeAllowlistEmail,
  resolveLoginEmailAccess,
  type LoginEmailAccessDecision,
} from "../../../auth/src/login-restriction.js";
import { client } from "../../../db/src/index.js";
import { publicProcedure, router } from "../index.js";

const LOGIN_EMAIL_ACCESS_CACHE_TTL_MS = 15_000;
const LOGIN_EMAIL_ACCESS_CACHE_MAX_ENTRIES = 2_000;

const loginEmailAccessCache = new Map<
  string,
  {
    access: LoginEmailAccessDecision;
    expiresAt: number;
  }
>();

const loginEmailSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});

function pruneExpiredLoginEmailAccessCache(now: number) {
  for (const [email, cached] of loginEmailAccessCache) {
    if (cached.expiresAt <= now) {
      loginEmailAccessCache.delete(email);
    }
  }
}

async function resolveCachedLoginEmailAccess(email: string) {
  const normalizedEmail = normalizeAllowlistEmail(email);
  const now = Date.now();
  const cached = loginEmailAccessCache.get(normalizedEmail);

  if (cached && cached.expiresAt > now) {
    return cached.access;
  }

  if (loginEmailAccessCache.size >= LOGIN_EMAIL_ACCESS_CACHE_MAX_ENTRIES) {
    pruneExpiredLoginEmailAccessCache(now);
  }

  if (loginEmailAccessCache.size >= LOGIN_EMAIL_ACCESS_CACHE_MAX_ENTRIES) {
    const oldestEmail = loginEmailAccessCache.keys().next().value;

    if (oldestEmail) {
      loginEmailAccessCache.delete(oldestEmail);
    }
  }

  const access = await resolveLoginEmailAccess(normalizedEmail, client);
  loginEmailAccessCache.set(normalizedEmail, {
    access,
    expiresAt: now + LOGIN_EMAIL_ACCESS_CACHE_TTL_MS,
  });

  return access;
}

export const authRouter = router({
  checkLoginEmail: publicProcedure
    .input(loginEmailSchema)
    .mutation(async ({ input }) => {
      const access = await resolveCachedLoginEmailAccess(input.email);

      if (!access.allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: LOGIN_RESTRICTION_BLOCK_MESSAGE,
          cause: {
            code: LOGIN_RESTRICTION_BLOCK_CODE,
          },
        });
      }

      return {
        allowed: true,
      };
    }),
});
