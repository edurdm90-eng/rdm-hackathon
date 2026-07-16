import type { LinkedAccount, User as PrivyUser } from "@privy-io/node";

import { normalizeAuthRecordId } from "./id-normalization.js";
import type { UserRole } from "./roles.js";

export const PRIVY_PROVIDER_ID = "privy";

export type PrivyExchangeInput = {
  accessToken: string;
};

export type PrivyExchangeResponse = {
  token: string;
  user: {
    email: string;
    emailVerified: boolean;
    id: string;
    image: string | null;
    name: string;
    role: UserRole;
  };
};

export type DerivedPrivyProfile = {
  email: string;
  emailVerified: true;
  image: string | null;
  linkedAccountType: string;
  name: string;
};

export type PrivyIdentityResolution =
  | { kind: "create" }
  | { kind: "email"; userId: string }
  | { kind: "linked"; userId: string }
  | { emailUserId: string; kind: "conflict"; linkedUserId: string };

type AccountCandidate = {
  email: string;
  image: string | null;
  linkedAccountType: string;
  name: string | null;
  priority: number;
};

function readString(
  account: LinkedAccount | Record<string, unknown>,
  keys: readonly string[],
): string | null {
  const record = account as unknown as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function hasVerificationMarker(account: LinkedAccount) {
  const record = account as unknown as Record<string, unknown>;

  return (
    typeof record.verified_at === "number" ||
    typeof record.latest_verified_at === "number" ||
    typeof record.first_verified_at === "number" ||
    record.verified === true
  );
}

function toCandidate(account: LinkedAccount): AccountCandidate | null {
  if (account.type === "email") {
    const email = readString(account, ["address", "email"]);

    if (!email || !hasVerificationMarker(account)) {
      return null;
    }

    return {
      email: email.toLowerCase(),
      image: null,
      linkedAccountType: account.type,
      name: null,
      priority: 0,
    };
  }

  if (!account.type.endsWith("_oauth")) {
    return null;
  }

  const email = readString(account, ["email"]);

  if (!email || !hasVerificationMarker(account)) {
    return null;
  }

  return {
    email: email.toLowerCase(),
    image: readString(account, [
      "profile_picture_url",
      "profile_picture",
      "avatar_url",
      "avatar",
      "picture",
      "image",
    ]),
    linkedAccountType: account.type,
    name: readString(account, ["name"]),
    priority: account.type === "google_oauth" ? 1 : 2,
  };
}

function formatEmailLocalPart(email: string) {
  const [localPart = "Privy User"] = email.split("@");

  return (
    localPart
      .split(/[._-]+/)
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ") || "Privy User"
  );
}

export function derivePrivyProfile(
  user: Pick<PrivyUser, "id" | "linked_accounts">,
): DerivedPrivyProfile | null {
  const linkedAccounts = user.linked_accounts ?? [];
  const candidates = linkedAccounts
    .map((account) => toCandidate(account))
    .filter((candidate): candidate is AccountCandidate => candidate !== null)
    .sort((left, right) => left.priority - right.priority);
  const primary = candidates[0];

  if (!primary) {
    return null;
  }

  const name =
    primary.name ??
    linkedAccounts
      .map((account) => readString(account, ["name"]))
      .find((candidate): candidate is string => Boolean(candidate)) ??
    formatEmailLocalPart(primary.email);

  const image =
    primary.image ??
    linkedAccounts
      .map((account) =>
        readString(account, [
          "profile_picture_url",
          "profile_picture",
          "avatar_url",
          "avatar",
          "picture",
          "image",
        ]),
      )
      .find((candidate): candidate is string => Boolean(candidate)) ??
    null;

  return {
    email: primary.email,
    emailVerified: true,
    image,
    linkedAccountType: primary.linkedAccountType,
    name,
  };
}

export function resolvePrivyIdentity(params: {
  emailUserId?: unknown;
  linkedUserId?: unknown;
}): PrivyIdentityResolution {
  const linkedUserId = normalizeAuthRecordId(params.linkedUserId);
  const emailUserId = normalizeAuthRecordId(params.emailUserId);

  if (linkedUserId && emailUserId && linkedUserId !== emailUserId) {
    return {
      emailUserId,
      kind: "conflict",
      linkedUserId,
    };
  }

  if (linkedUserId) {
    return {
      kind: "linked",
      userId: linkedUserId,
    };
  }

  if (emailUserId) {
    return {
      kind: "email",
      userId: emailUserId,
    };
  }

  return {
    kind: "create",
  };
}
