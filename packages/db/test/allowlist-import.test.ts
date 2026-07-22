import { describe, expect, it } from "bun:test";

import { parseAllowlistImport } from "../src/allowlist-import.js";

describe("parseAllowlistImport", () => {
  it("parses email-only files and normalizes addresses", () => {
    expect(
      parseAllowlistImport(`email
Student@Example.COM
second@example.com
`),
    ).toMatchObject({
      duplicateRows: 0,
      invalidRows: [],
      rows: [
        {
          email: "student@example.com",
          role: "member",
        },
        {
          email: "second@example.com",
          role: "member",
        },
      ],
    });
  });

  it("parses optional roles and skips duplicate emails", () => {
    expect(
      parseAllowlistImport(`email,role
host@example.com,host
HOST@example.com,member
student@example.com,member
`),
    ).toMatchObject({
      duplicateRows: 1,
      invalidRows: [],
      rows: [
        {
          email: "host@example.com",
          role: "host",
        },
        {
          email: "student@example.com",
          role: "member",
        },
      ],
    });
  });

  it("reports invalid emails", () => {
    expect(parseAllowlistImport("not-an-email")).toMatchObject({
      duplicateRows: 0,
      invalidRows: [
        {
          line: 1,
          reason: "Invalid email",
          value: "not-an-email",
        },
      ],
      rows: [],
    });
  });

  it("reports invalid roles", () => {
    expect(
      parseAllowlistImport("email,role\nstudent@example.com,admin"),
    ).toMatchObject({
      duplicateRows: 0,
      invalidRows: [
        {
          line: 2,
          reason: 'Invalid role "admin"',
          value: "student@example.com,admin",
        },
      ],
      rows: [],
    });
  });
});
