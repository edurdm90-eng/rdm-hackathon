import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import mongoose from "mongoose";

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

function getPositionalArgs() {
  return process.argv
    .slice(2)
    .filter((arg) => arg && arg !== "--" && !arg.startsWith("--"));
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function parseRestrictionValue(value: string | undefined) {
  const normalizedValue = value?.trim().toLowerCase();

  if (normalizedValue === "on" || normalizedValue === "true") {
    return true;
  }

  if (normalizedValue === "off" || normalizedValue === "false") {
    return false;
  }

  throw new Error("Use one of: bun run restriction on | off");
}

function printUsage() {
  console.log(`Toggle login allowlist restriction.

Usage:
  bun run restriction on
  bun run restriction off
`);
}

async function setLoginRestriction() {
  if (hasFlag("--help") || hasFlag("-h")) {
    printUsage();
    return;
  }

  const isrestriction = parseRestrictionValue(getPositionalArgs()[0]);
  loadEnvFiles();
  const { client } = await import("../src/index.js");
  const now = new Date();

  await client.collection("app_settings").updateOne(
    { key: "login_restriction" },
    {
      $set: {
        isrestriction,
        key: "login_restriction",
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true },
  );

  console.log("Login restriction updated:");
  console.log(
    JSON.stringify(
      {
        isrestriction,
        key: "login_restriction",
      },
      null,
      2,
    ),
  );
}

try {
  await setLoginRestriction();
} finally {
  await mongoose.disconnect();
}
