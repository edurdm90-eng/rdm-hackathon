import { describe, expect, it } from "bun:test";

import { derivePrivyProfile, resolvePrivyIdentity } from "../src/privy-bridge.js";
import { normalizeUserRole } from "../src/roles.js";

describe("derivePrivyProfile", () => {
  it("prefers a verified email account over verified OAuth accounts", () => {
    const profile = derivePrivyProfile({
      id: "privy-user-1",
      linked_accounts: [
        {
          email: "social@example.com",
          name: "Social Name",
          profile_picture_url: "https://example.com/avatar.png",
          type: "google_oauth",
          verified_at: 1,
        },
        {
          address: "Member@Example.com",
          type: "email",
          verified_at: 2,
        },
      ],
    } as never);

    expect(profile).toEqual({
      email: "member@example.com",
      emailVerified: true,
      image: "https://example.com/avatar.png",
      linkedAccountType: "email",
      name: "Social Name",
    });
  });

  it("rejects wallet-only Privy users", () => {
    const profile = derivePrivyProfile({
      id: "privy-user-2",
      linked_accounts: [
        {
          address: "0x0000000000000000000000000000000000000000",
          type: "wallet",
        },
      ],
    } as never);

    expect(profile).toBeNull();
  });
});

describe("resolvePrivyIdentity", () => {
  it("keeps idempotent linked and email matches on the same user", () => {
    expect(
      resolvePrivyIdentity({
        emailUserId: "user_1",
        linkedUserId: "user_1",
      }),
    ).toEqual({
      kind: "linked",
      userId: "user_1",
    });
  });

  it("detects linked-account and email-account conflicts", () => {
    expect(
      resolvePrivyIdentity({
        emailUserId: "user_email",
        linkedUserId: "user_linked",
      }),
    ).toEqual({
      emailUserId: "user_email",
      kind: "conflict",
      linkedUserId: "user_linked",
    });
  });
});

describe("normalizeUserRole", () => {
  it("defaults missing or invalid roles to member", () => {
    expect(normalizeUserRole(undefined)).toBe("member");
    expect(normalizeUserRole("organizer")).toBe("member");
  });

  it("preserves host roles", () => {
    expect(normalizeUserRole("host")).toBe("host");
  });
});
