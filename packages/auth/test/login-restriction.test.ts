import { describe, expect, it } from "bun:test";

import {
  LOGIN_RESTRICTION_SETTINGS_KEY,
  normalizeAllowlistEmail,
  resolveLoginRestriction,
  type LoginRestrictionDb,
} from "../src/login-restriction.js";

function createRestrictionDb(input: {
  allowlist?: Array<Record<string, unknown>>;
  isrestriction?: boolean;
}): LoginRestrictionDb {
  const settings =
    input.isrestriction === undefined
      ? null
      : {
          isrestriction: input.isrestriction,
          key: LOGIN_RESTRICTION_SETTINGS_KEY,
        };

  return {
    collection(name) {
      return {
        async findOne(filter) {
          if (name === "app_settings") {
            return filter.key === LOGIN_RESTRICTION_SETTINGS_KEY
              ? (settings as never)
              : null;
          }

          if (name !== "allowlist") {
            return null;
          }

          const email = (
            (filter.$or as Array<Record<string, string>> | undefined)?.[0]
              ?.normalizedEmail ?? ""
          ).toLowerCase();

          return (input.allowlist?.find(
            (row) =>
              row.status === "active" &&
              (row.normalizedEmail === email || row.email === email),
          ) ?? null) as never;
        },
      };
    },
  };
}

describe("normalizeAllowlistEmail", () => {
  it("normalizes spaces and case", () => {
    expect(normalizeAllowlistEmail("  Student@Example.COM ")).toBe(
      "student@example.com",
    );
  });
});

describe("resolveLoginRestriction", () => {
  it("allows anyone when restriction setting is missing", async () => {
    await expect(
      resolveLoginRestriction(
        "outsider@example.com",
        createRestrictionDb({ allowlist: [] }),
      ),
    ).resolves.toMatchObject({
      allowed: true,
      isrestriction: false,
    });
  });

  it("allows anyone when restriction is false", async () => {
    await expect(
      resolveLoginRestriction(
        "outsider@example.com",
        createRestrictionDb({ allowlist: [], isrestriction: false }),
      ),
    ).resolves.toMatchObject({
      allowed: true,
      isrestriction: false,
    });
  });

  it("allows active allowlisted emails when restriction is true", async () => {
    await expect(
      resolveLoginRestriction(
        "Student@Example.COM",
        createRestrictionDb({
          allowlist: [
            {
              normalizedEmail: "student@example.com",
              role: "host",
              status: "active",
            },
          ],
          isrestriction: true,
        }),
      ),
    ).resolves.toEqual({
      allowed: true,
      isrestriction: true,
      role: "host",
    });
  });

  it("blocks emails that are not active allowlist records", async () => {
    await expect(
      resolveLoginRestriction(
        "student@example.com",
        createRestrictionDb({
          allowlist: [
            {
              normalizedEmail: "student@example.com",
              status: "inactive",
            },
          ],
          isrestriction: true,
        }),
      ),
    ).resolves.toEqual({
      allowed: false,
      isrestriction: true,
      role: null,
    });
  });
});
