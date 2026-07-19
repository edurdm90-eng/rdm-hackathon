import mongoose from "mongoose";

import { client } from "../src/index.js";

const validRoles = ["member", "host"] as const;
type UserRole = (typeof validRoles)[number];

function getArgValue(name: string) {
  const inlineArg = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (inlineArg) {
    return inlineArg.slice(name.length + 1).trim();
  }

  const argIndex = process.argv.indexOf(name);
  if (argIndex >= 0) {
    return process.argv[argIndex + 1]?.trim();
  }

  return undefined;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseRole(value: string | undefined): UserRole {
  if (value === "member" || value === "host") {
    return value;
  }

  throw new Error(`Invalid role "${value ?? ""}". Use one of: ${validRoles.join(", ")}.`);
}

async function backfillMissingRoles() {
  const result = await client.collection("user").updateMany(
    { role: { $exists: false } },
    {
      $set: {
        role: "member",
        updatedAt: new Date(),
      },
    },
  );

  console.log(`Backfilled ${result.modifiedCount} user role(s) to member.`);
}

async function setUserRole() {
  const email = getArgValue("--email")?.toLowerCase();
  const role = parseRole(getArgValue("--role"));

  if (!email) {
    throw new Error("Missing --email. Example: bun run role:set -- --email yash@gmail.com --role host");
  }

  const result = await client.collection("user").findOneAndUpdate(
    {
      email: {
        $options: "i",
        $regex: `^${escapeRegex(email)}$`,
      },
    },
    {
      $set: {
        role,
        updatedAt: new Date(),
      },
    },
    {
      projection: {
        email: 1,
        name: 1,
        role: 1,
      },
      returnDocument: "after",
    },
  );

  if (!result) {
    throw new Error(`No user found with email ${email}.`);
  }

  console.log("Updated user role:");
  console.log(JSON.stringify(result, null, 2));
}

try {
  if (hasFlag("--backfill-missing")) {
    await backfillMissingRoles();
  } else {
    await setUserRole();
  }
} finally {
  await mongoose.disconnect();
}
