import { isUserRole, type UserRole } from "./roles.js";
export {
  LOGIN_RESTRICTION_BLOCK_CODE,
  LOGIN_RESTRICTION_BLOCK_MESSAGE,
  LOGIN_RESTRICTION_SETTINGS_KEY,
} from "./login-restriction-constants.js";
import { LOGIN_RESTRICTION_SETTINGS_KEY } from "./login-restriction-constants.js";

type LoginRestrictionSettingsRecord = {
  isrestriction?: unknown;
  key: string;
};

type AllowlistRecord = {
  email?: string;
  normalizedEmail?: string;
  role?: unknown;
  status?: unknown;
};

type FindOneCollection<TRecord> = {
  findOne: (filter: Record<string, unknown>) => Promise<TRecord | null>;
};

export type LoginRestrictionDb = {
  collection: <TRecord>(name: string) => FindOneCollection<TRecord>;
};

export type LoginRestrictionDecision = {
  allowed: boolean;
  isrestriction: boolean;
  role: UserRole | null;
};

export function normalizeAllowlistEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeAllowlistRole(value: unknown): UserRole {
  return isUserRole(value) ? value : "member";
}

export async function resolveLoginRestriction(
  email: string,
  db: LoginRestrictionDb,
): Promise<LoginRestrictionDecision> {
  const normalizedEmail = normalizeAllowlistEmail(email);
  const settings = await db
    .collection<LoginRestrictionSettingsRecord>("app_settings")
    .findOne({ key: LOGIN_RESTRICTION_SETTINGS_KEY });
  const isrestriction = settings?.isrestriction === true;

  if (!isrestriction) {
    return {
      allowed: true,
      isrestriction,
      role: null,
    };
  }

  const allowlistRecord = await db
    .collection<AllowlistRecord>("allowlist")
    .findOne({
      $or: [{ normalizedEmail }, { email: normalizedEmail }],
      status: "active",
    });

  return {
    allowed: Boolean(allowlistRecord),
    isrestriction,
    role: allowlistRecord ? normalizeAllowlistRole(allowlistRecord.role) : null,
  };
}
