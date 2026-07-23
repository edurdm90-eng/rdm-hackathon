import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import mongoose from "mongoose";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

type IndexKey = Record<string, 1 | -1>;
type IndexSpec = {
  collection: string;
  keys: IndexKey;
  options?: {
    background?: boolean;
    name?: string;
    sparse?: boolean;
    unique?: boolean;
  };
};

const defaultIndexOptions = {
  background: true,
};

const indexes: IndexSpec[] = [
  {
    collection: "app_settings",
    keys: { key: 1 },
    options: { unique: true },
  },
  {
    collection: "allowlist",
    keys: { normalizedEmail: 1 },
    options: { unique: true },
  },
  {
    collection: "allowlist",
    keys: { email: 1, status: 1 },
    options: {},
  },
  {
    collection: "allowlist",
    keys: { status: 1 },
    options: {},
  },
  {
    collection: "user",
    keys: { id: 1 },
    options: { name: "user_better_auth_id", sparse: true },
  },
  {
    collection: "user",
    keys: { email: 1 },
    options: { name: "user_email" },
  },
  {
    collection: "hack_rooms",
    keys: { inviteCode: 1, onchainStatus: 1, status: 1 },
    options: { name: "hack_rooms_invite_status" },
  },
  {
    collection: "hack_rooms",
    keys: { createTxHash: 1 },
    options: { name: "hack_rooms_create_tx_hash", sparse: true },
  },
  {
    collection: "hack_rooms",
    keys: { hostId: 1, onchainStatus: 1, status: 1, updatedAt: -1 },
    options: { name: "hack_rooms_host_dashboard" },
  },
  {
    collection: "hack_rooms",
    keys: { "participants.userId": 1, onchainStatus: 1, status: 1, updatedAt: -1 },
    options: { name: "hack_rooms_participant_dashboard" },
  },
  {
    collection: "hack_tasks",
    keys: { roomId: 1, createdAt: -1 },
    options: { name: "hack_tasks_room_created" },
  },
  {
    collection: "hack_tasks",
    keys: { assignedToUserId: 1, assignedToEmail: 1, roomId: 1 },
    options: { name: "hack_tasks_special_assignment" },
  },
  {
    collection: "hack_submissions",
    keys: { participantId: 1, submittedAt: -1 },
    options: { name: "hack_submissions_participant" },
  },
  {
    collection: "hack_submissions",
    keys: { roomId: 1, status: 1, submittedAt: -1 },
    options: { name: "hack_submissions_room_status" },
  },
  {
    collection: "hack_submissions",
    keys: { taskId: 1, participantId: 1 },
    options: { name: "hack_submissions_task_participant" },
  },
  {
    collection: "hack_rewards",
    keys: { roomId: 1, status: 1, issuedAt: -1 },
    options: { name: "hack_rewards_room_status" },
  },
  {
    collection: "hack_rewards",
    keys: { "recipients.userId": 1, status: 1, issuedAt: -1 },
    options: { name: "hack_rewards_recipient_status" },
  },
  {
    collection: "hack_notifications",
    keys: { recipientIds: 1, roomId: 1, createdAt: -1 },
    options: { name: "hack_notifications_recipient_ids" },
  },
  {
    collection: "hack_notifications",
    keys: { recipientEmails: 1, roomId: 1, createdAt: -1 },
    options: { name: "hack_notifications_recipient_emails" },
  },
  {
    collection: "hack_chain_events",
    keys: { idempotencyKey: 1 },
    options: { name: "hack_chain_events_idempotency_unique", unique: true },
  },
  {
    collection: "hack_chain_events",
    keys: { txHash: 1, kind: 1 },
    options: { name: "hack_chain_events_tx_kind" },
  },
  {
    collection: "hack_chain_events",
    keys: { roomId: 1, kind: 1, status: 1 },
    options: { name: "hack_chain_events_room_kind_status" },
  },
];

function loadEnvFiles() {
  [
    path.join(repoRoot, "apps/server/.env"),
    path.join(repoRoot, "apps/server/.env.local"),
    path.join(repoRoot, ".env.local"),
  ].forEach((envPath) => {
    dotenv.config({ override: false, path: envPath });
  });
}

async function ensureIndexes() {
  loadEnvFiles();
  const { client } = await import("../src/index.js");
  const failures: Array<{ collection: string; error: unknown; name: string }> = [];

  for (const index of indexes) {
    const options = {
      ...defaultIndexOptions,
      ...index.options,
    };
    const name = options.name ?? Object.keys(index.keys).join("_");

    try {
      await client.collection(index.collection).createIndex(index.keys, options);
      console.log(`verified ${index.collection}.${name}`);
    } catch (error) {
      failures.push({ collection: index.collection, error, name });
      console.error(`failed ${index.collection}.${name}`);
      console.error(error instanceof Error ? error.message : error);
    }
  }

  if (failures.length) {
    throw new Error(`Failed to verify ${failures.length} database index(es).`);
  }
}

try {
  await ensureIndexes();
  console.log("Database indexes verified.");
} finally {
  await mongoose.disconnect();
}
