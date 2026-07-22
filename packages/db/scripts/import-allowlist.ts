import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import mongoose from "mongoose";

import { parseAllowlistImport } from "../src/allowlist-import.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

function loadEnvFiles() {
  [
    path.join(repoRoot, "apps/server/.env"),
    path.join(repoRoot, "apps/server/.env.local"),
    path.join(repoRoot, ".env.local"),
  ].forEach((envPath) => {
    dotenv.config({ override: false, path: envPath });
  });
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function getPositionalArgs() {
  return process.argv
    .slice(2)
    .filter((arg) => arg && arg !== "--" && !arg.startsWith("--"));
}

function printUsage() {
  console.log(`Import login allowlist emails from CSV or TXT.

Usage:
  bun run allow:bulk ./allowed-mails.csv
  bun run allow:bulk ./allowed-mails.csv --dry-run

Accepted CSV formats:
  email
  student@example.com

  email,role
  student@example.com,member
  host@example.com,host
`);
}

async function importAllowlist() {
  if (hasFlag("--help") || hasFlag("-h")) {
    printUsage();
    return;
  }

  const filePath = getPositionalArgs()[0];

  if (!filePath) {
    throw new Error(
      "Missing allowlist file. Example: bun run allow:bulk ./allowed-mails.csv",
    );
  }

  const dryRun = hasFlag("--dry-run");
  const absoluteFilePath = path.resolve(repoRoot, filePath);
  const contents = await readFile(absoluteFilePath, "utf8");
  const parsed = parseAllowlistImport(contents);

  if (dryRun) {
    console.log("Allowlist import dry run:");
    console.log(
      JSON.stringify(
        {
          duplicateRows: parsed.duplicateRows,
          invalidRows: parsed.invalidRows,
          validRows: parsed.rows.length,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (parsed.invalidRows.length > 0) {
    throw new Error(
      `Allowlist import has ${parsed.invalidRows.length} invalid row(s). Run with --dry-run to inspect details before importing.`,
    );
  }

  if (parsed.rows.length === 0) {
    throw new Error("Allowlist import has no valid email rows.");
  }

  loadEnvFiles();
  const { client } = await import("../src/index.js");
  const allowlist = client.collection("allowlist");
  const now = new Date();
  let added = 0;
  let unchanged = 0;
  let updated = 0;

  await allowlist.createIndex({ normalizedEmail: 1 }, { unique: true });
  await allowlist.createIndex({ status: 1 });

  for (const row of parsed.rows) {
    const result = await allowlist.updateOne(
      { normalizedEmail: row.email },
      {
        $set: {
          email: row.email,
          normalizedEmail: row.email,
          role: row.role,
          status: "active",
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true },
    );

    if (result.upsertedCount > 0) {
      added += 1;
    } else if (result.modifiedCount > 0) {
      updated += 1;
    } else {
      unchanged += 1;
    }
  }

  console.log("Allowlist import result:");
  console.log(
    JSON.stringify(
      {
        added,
        duplicateRows: parsed.duplicateRows,
        invalidRows: parsed.invalidRows,
        unchanged,
        updated,
        validRows: parsed.rows.length,
      },
      null,
      2,
    ),
  );
}

try {
  await importAllowlist();
} finally {
  await mongoose.disconnect();
}
