import { describe, expect, it } from "bun:test";

import {
  isAdminEmailAllowed,
  isAdminExchangeAllowed,
  normalizeAdminEmail,
} from "../src/admin-access";

describe("admin access", () => {
  it("normalizes email casing and surrounding whitespace", () => {
    expect(normalizeAdminEmail("  Founder@RDM.io ")).toBe("founder@rdm.io");
  });

  it("allows a normalized email from the configured list", () => {
    expect(
      isAdminEmailAllowed("Founder@RDM.io", ["ops@rdm.io", " founder@rdm.io "]),
    ).toBe(true);
  });

  it("denies empty and unconfigured emails", () => {
    expect(isAdminEmailAllowed("", ["founder@rdm.io"])).toBe(false);
    expect(isAdminEmailAllowed("member@rdm.io", ["founder@rdm.io"])).toBe(false);
    expect(isAdminEmailAllowed("founder@rdm.io", [])).toBe(false);
  });

  it("only bypasses the product restriction for explicit admin exchanges", () => {
    const allowedEmails = ["founder@rdm.io"];

    expect(
      isAdminExchangeAllowed(undefined, "founder@rdm.io", allowedEmails),
    ).toBe(false);
    expect(
      isAdminExchangeAllowed("admin", "member@rdm.io", allowedEmails),
    ).toBe(false);
    expect(
      isAdminExchangeAllowed("admin", "founder@rdm.io", allowedEmails),
    ).toBe(true);
  });
});
