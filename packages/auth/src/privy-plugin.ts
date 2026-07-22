import {
  APIError,
  createAuthEndpoint,
  formCsrfMiddleware,
} from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
import type { PrivyClient, User as PrivyUser } from "@privy-io/node";
import { ObjectId } from "mongodb";

import { client as authDbClient } from "../../db/src/index.js";
import { env } from "../../env/src/server.js";
import {
  derivePrivyProfile,
  PRIVY_PROVIDER_ID,
  resolvePrivyIdentity,
  type DerivedPrivyProfile,
} from "./privy-bridge.js";
import { normalizeAuthRecordId } from "./id-normalization.js";
import {
  LOGIN_RESTRICTION_BLOCK_CODE,
  LOGIN_RESTRICTION_BLOCK_MESSAGE,
  resolveLoginRestriction,
} from "./login-restriction.js";
import { isUserRole, normalizeUserRole, type UserRole } from "./roles.js";

const privyExchangeBodySchema = z.object({
  accessToken: z.string().min(1),
});

const PRIVY_API_TIMEOUT_MS = 8_000;
const PRIVY_EXCHANGE_STEP_TIMEOUT_MS = 12_000;

type BetterAuthUserRecord = {
  createdAt: Date;
  email: string;
  emailVerified: boolean;
  _id?: unknown;
  id?: unknown;
  image?: string | null;
  name: string;
  role?: unknown;
  updatedAt: Date;
};

type NormalizedBetterAuthUserRecord = BetterAuthUserRecord & {
  id: string;
  role: UserRole;
  roleNeedsPersist: boolean;
};

type BetterAuthUserUpdate = Partial<
  Pick<BetterAuthUserRecord, "emailVerified" | "image" | "name">
>;

let privyClientPromise: Promise<PrivyClient> | null = null;
let privyNodeModulePromise: Promise<typeof import("@privy-io/node")> | null =
  null;

class OperationTimeoutError extends Error {
  constructor(
    readonly operation: string,
    readonly timeoutMs: number,
  ) {
    super(`${operation} timed out after ${timeoutMs}ms`);
    this.name = "OperationTimeoutError";
  }
}

function isOperationTimeoutError(
  error: unknown,
): error is OperationTimeoutError {
  return error instanceof OperationTimeoutError;
}

async function withTimeout<T>(
  operation: string,
  promise: Promise<T>,
  timeoutMs: number,
) {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new OperationTimeoutError(operation, timeoutMs));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function normalizePemKey(value: string) {
  return value
    .trim()
    .replace(/^["']/, "")
    .replace(/["']$/, "")
    .replace(/\\n/g, "\n");
}

function loadPrivyNode() {
  if (!privyNodeModulePromise) {
    privyNodeModulePromise = import("@privy-io/node");
  }

  return privyNodeModulePromise;
}

function getPrivyClient() {
  if (!privyClientPromise) {
    privyClientPromise = loadPrivyNode().then(
      ({ PrivyClient: LoadedPrivyClient }) =>
        new LoadedPrivyClient({
          appId: env.PRIVY_APP_ID,
          appSecret: env.PRIVY_APP_SECRET,
          jwtVerificationKey: normalizePemKey(env.PRIVY_JWT_VERIFICATION_KEY),
          maxRetries: 0,
          timeout: PRIVY_API_TIMEOUT_MS,
        }),
    );
  }

  return privyClientPromise;
}

function getBetterAuthUserId(user: BetterAuthUserRecord) {
  const id = normalizeAuthRecordId(user.id ?? user._id);

  if (!id) {
    throw new Error("Better Auth user record is missing an id.");
  }

  return id;
}

function normalizeBetterAuthUser(
  user: BetterAuthUserRecord,
): NormalizedBetterAuthUserRecord {
  return {
    ...user,
    id: getBetterAuthUserId(user),
    role: normalizeUserRole(user.role),
    roleNeedsPersist: !isUserRole(user.role),
  };
}

function buildSafeUser(user: NormalizedBetterAuthUserRecord) {
  return {
    email: user.email,
    emailVerified: user.emailVerified,
    id: user.id,
    image: user.image ?? null,
    name: user.name,
    role: user.role,
  };
}

function buildUserUpdate(
  user: NormalizedBetterAuthUserRecord,
  profile: DerivedPrivyProfile,
): BetterAuthUserUpdate | null {
  const update: BetterAuthUserUpdate = {};

  if (!user.emailVerified) {
    update.emailVerified = true;
  }

  if (!user.image && profile.image) {
    update.image = profile.image;
  }

  if (!user.name.trim()) {
    update.name = profile.name;
  }

  return Object.keys(update).length > 0 ? update : null;
}

function authUserDocumentFilter(userId: string) {
  const filters: Array<Record<string, unknown>> = [{ id: userId }];

  if (ObjectId.isValid(userId)) {
    filters.push({ _id: new ObjectId(userId) });
  }

  return { $or: filters };
}

async function persistAuthUserDefaults(user: NormalizedBetterAuthUserRecord) {
  await authDbClient
    .collection("user")
    .updateOne(authUserDocumentFilter(user.id), {
      $set: {
        role: user.role,
        updatedAt: new Date(),
      },
    });
}

type PrivyUserVerificationDependencies = {
  loadUser: (userId: string) => Promise<PrivyUser | null>;
  verifyAccessToken: (input: {
    access_token: string;
    app_id: string;
    verification_key: string;
  }) => Promise<{ user_id: string }>;
};

export async function loadVerifiedPrivyUser(
  accessToken: string,
  dependencies?: PrivyUserVerificationDependencies,
) {
  const verifyAccessToken =
    dependencies?.verifyAccessToken ??
    (async (input) => {
      const privyNode = await loadPrivyNode();
      const verified = await privyNode.verifyAccessToken(input);

      return {
        user_id: verified.user_id,
      };
    });
  const loadUser =
    dependencies?.loadUser ??
    (async (userId) => {
      const client = await getPrivyClient();

      return client.users()._get(userId, {
        maxRetries: 0,
        timeout: PRIVY_API_TIMEOUT_MS,
      }) as Promise<PrivyUser>;
    });
  const verifiedToken = await withTimeout(
    "privy.verify_access_token",
    verifyAccessToken({
      access_token: accessToken,
      app_id: env.PRIVY_APP_ID,
      verification_key: normalizePemKey(env.PRIVY_JWT_VERIFICATION_KEY),
    }),
    PRIVY_EXCHANGE_STEP_TIMEOUT_MS,
  );
  const user = await withTimeout(
    "privy.load_user",
    loadUser(verifiedToken.user_id),
    PRIVY_EXCHANGE_STEP_TIMEOUT_MS,
  );

  if (!user || user.id !== verifiedToken.user_id) {
    throw new Error(
      "Privy full user record is missing or does not match the verified token.",
    );
  }

  return user;
}

export function privyBridge() {
  return {
    endpoints: {
      privyExchange: createAuthEndpoint(
        "/privy/exchange",
        {
          body: privyExchangeBodySchema,
          metadata: {
            openapi: {
              description:
                "Exchange a Privy access token for a Better Auth session.",
              operationId: "exchangePrivySession",
            },
          },
          method: "POST",
          requireHeaders: true,
          use: [formCsrfMiddleware],
        },
        async (ctx) => {
          const exchangeStartedAt = Date.now();
          const logStep = (step: string, extra?: Record<string, unknown>) => {
            ctx.context.logger.info(`privy.exchange.${step}`, {
              durationMs: Date.now() - exchangeStartedAt,
              ...extra,
            });
          };
          let privyUser: PrivyUser;

          try {
            logStep("started");
            privyUser = await loadVerifiedPrivyUser(ctx.body.accessToken);
          } catch (error) {
            if (isOperationTimeoutError(error)) {
              ctx.context.logger.error(
                "privy.exchange.timeout",
                {
                  durationMs: Date.now() - exchangeStartedAt,
                  operation: error.operation,
                  timeoutMs: error.timeoutMs,
                },
                error,
              );
              throw new APIError("SERVICE_UNAVAILABLE", {
                code: "PRIVY_EXCHANGE_TIMEOUT",
                message: "Privy session exchange timed out. Please try again.",
              });
            }

            ctx.context.logger.error(
              "privy.exchange.invalid_token",
              { durationMs: Date.now() - exchangeStartedAt },
              error,
            );
            throw new APIError("UNAUTHORIZED", {
              code: "PRIVY_INVALID_ACCESS_TOKEN",
              message: "Privy access token is invalid or expired.",
            });
          }

          const profile = derivePrivyProfile(privyUser);
          logStep("verified_privy_user", {
            linkedAccountCount: privyUser.linked_accounts?.length ?? 0,
            privyUserId: privyUser.id,
          });

          if (!profile) {
            ctx.context.logger.info("privy.exchange.missing_email", {
              privyLinkedAccountCount: privyUser.linked_accounts?.length ?? 0,
              privyUserId: privyUser.id,
            });
            throw new APIError("BAD_REQUEST", {
              code: "PRIVY_EMAIL_REQUIRED",
              message: "Privy account does not have a verified email address.",
            });
          }

          const loginRestriction = await resolveLoginRestriction(
            profile.email,
            authDbClient,
          );

          if (!loginRestriction.allowed) {
            ctx.context.logger.info("privy.exchange.email_not_allowlisted", {
              durationMs: Date.now() - exchangeStartedAt,
              email: profile.email,
              isrestriction: loginRestriction.isrestriction,
              privyUserId: privyUser.id,
            });
            throw new APIError("FORBIDDEN", {
              code: LOGIN_RESTRICTION_BLOCK_CODE,
              message: LOGIN_RESTRICTION_BLOCK_MESSAGE,
            });
          }

          const linkedAccount =
            await ctx.context.internalAdapter.findAccountByProviderId(
              privyUser.id,
              PRIVY_PROVIDER_ID,
            );
          const linkedAccountUserId = normalizeAuthRecordId(
            linkedAccount?.userId,
          );
          const linkedUser = linkedAccountUserId
            ? await ctx.context.internalAdapter.findUserById(
                linkedAccountUserId,
              )
            : null;
          const normalizedLinkedUser = linkedUser
            ? normalizeBetterAuthUser(linkedUser as BetterAuthUserRecord)
            : null;
          const emailLookup = await ctx.context.internalAdapter.findUserByEmail(
            profile.email,
          );
          const emailUser = (emailLookup?.user ??
            null) as BetterAuthUserRecord | null;
          const normalizedEmailUser = emailUser
            ? normalizeBetterAuthUser(emailUser)
            : null;
          const identityResolution = resolvePrivyIdentity({
            emailUserId: normalizedEmailUser?.id ?? null,
            linkedUserId: normalizedLinkedUser?.id ?? null,
          });
          logStep("resolved_identity", {
            identityResolution: identityResolution.kind,
            privyUserId: privyUser.id,
          });

          if (linkedAccount && !normalizedLinkedUser) {
            ctx.context.logger.error("privy.exchange.orphaned_link", {
              betterAuthUserId: linkedAccount.userId,
              privyUserId: privyUser.id,
            });
            throw new APIError("INTERNAL_SERVER_ERROR", {
              code: "PRIVY_LINK_ORPHANED",
              message: "Privy linkage points to a missing Better Auth user.",
            });
          }

          if (identityResolution.kind === "conflict") {
            ctx.context.logger.error("privy.exchange.link_conflict", {
              email: profile.email,
              emailUserId: identityResolution.emailUserId,
              linkedUserId: identityResolution.linkedUserId,
              privyUserId: privyUser.id,
            });
            throw new APIError("CONFLICT", {
              code: "PRIVY_ACCOUNT_CONFLICT",
              message:
                "Privy account could not be linked because it matches a different Better Auth user.",
            });
          }

          let user: NormalizedBetterAuthUserRecord;
          let createdUser = false;

          if (identityResolution.kind === "linked" && normalizedLinkedUser) {
            user = normalizedLinkedUser;
          } else if (
            identityResolution.kind === "email" &&
            normalizedEmailUser
          ) {
            user = normalizedEmailUser;
          } else {
            user = normalizeBetterAuthUser(
              (await ctx.context.internalAdapter.createUser({
                email: profile.email,
                emailVerified: true,
                image: profile.image ?? undefined,
                name: profile.name,
                role: "member",
              })) as BetterAuthUserRecord,
            );
            createdUser = true;
          }

          const userUpdate = buildUserUpdate(user, profile);

          if (userUpdate) {
            user = normalizeBetterAuthUser(
              (await ctx.context.internalAdapter.updateUser(
                user.id,
                userUpdate,
              )) as BetterAuthUserRecord,
            );
          }

          await persistAuthUserDefaults(user);

          if (!linkedAccount) {
            await ctx.context.internalAdapter.createAccount({
              accountId: privyUser.id,
              providerId: PRIVY_PROVIDER_ID,
              userId: user.id,
            });
          }
          logStep("persisted_user", {
            betterAuthUserId: user.id,
            createdUser,
            privyUserId: privyUser.id,
          });

          const session = await ctx.context.internalAdapter.createSession(
            user.id,
          );

          await setSessionCookie(ctx, {
            session,
            user,
          });

          ctx.context.logger.info("privy.exchange.success", {
            betterAuthUserId: user.id,
            createdUser,
            durationMs: Date.now() - exchangeStartedAt,
            email: user.email,
            linkedAccountType: profile.linkedAccountType,
            privyUserId: privyUser.id,
            role: user.role,
          });

          return ctx.json({
            token: session.token,
            user: buildSafeUser(user),
          });
        },
      ),
    },
    id: "privy-bridge",
  } as const;
}
