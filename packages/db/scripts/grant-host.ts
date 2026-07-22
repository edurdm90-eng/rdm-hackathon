import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  polygonAmoyChain,
  polygonAmoyDeployment,
  xrdmImplementationAbi,
} from "@rdm-hack/blockchain-client";
import dotenv from "dotenv";
import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  isAddress,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import mongoose from "mongoose";

type DbUser = {
  _id: unknown;
  email: string;
  embeddedWalletAddress?: string | null;
  name?: string | null;
  onchainAddress?: string | null;
  role?: "host" | "member" | null;
  smartWalletAddress?: string | null;
};

type HostGrantPlan = {
  chainHostAlreadyApproved: boolean;
  dryRun: boolean;
  email: string;
  offchainRoleAlreadyHost: boolean;
  ownerAddress?: Hex;
  txHash?: Hex;
  userAddress: Hex;
  userId: unknown;
};

const privateKeyEnvNames = [
  "XRDM_OWNER_PRIVATE_KEY",
  "BLOCKCHAIN_OWNER_PRIVATE_KEY",
  "ONCHAIN_OWNER_PRIVATE_KEY",
  "PRIVATE_KEY",
] as const;

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

function getPositionalArgs() {
  const positionalArgs: Array<string> = [];
  const optionsWithValues = new Set(["--email", "--private-key"]);

  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (!arg || arg === "--") {
      continue;
    }

    if (arg.startsWith("--")) {
      if (arg.includes("=")) {
        continue;
      }
      if (optionsWithValues.has(arg)) {
        index += 1;
      }
      continue;
    }

    positionalArgs.push(arg);
  }

  return positionalArgs;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function printUsage() {
  console.log(`Grant a user host access offchain and onchain.

Usage:
  bun run host person@example.com
  bun run host person@example.com --dry-run
  bun run host:grant -- --email person@example.com
  bun run host:grant -- --email person@example.com --dry-run

Owner key:
  Set one env var: ${privateKeyEnvNames.join(", ")}
  Or pass: --private-key 0x...

What it does:
  1. Finds the Better Auth user by email in MongoDB.
  2. Uses user.onchainAddress, then user.smartWalletAddress as the canonical host wallet.
  3. Reads isApprovedHost(wallet) on Polygon Amoy.
  4. If needed, sends addHackathonHost(wallet) from the contract owner key.
  5. Only after onchain success, sets user.role = "host" in MongoDB.
`);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeEmail(value: string | undefined) {
  return value?.trim().toLowerCase();
}

function normalizePrivateKey(value: string | undefined): Hex | null {
  const privateKey = value?.trim();
  if (!privateKey) {
    return null;
  }

  return privateKey.startsWith("0x")
    ? (privateKey as Hex)
    : (`0x${privateKey}` as Hex);
}

function getOwnerPrivateKey() {
  const cliPrivateKey = normalizePrivateKey(getArgValue("--private-key"));
  if (cliPrivateKey) {
    return cliPrivateKey;
  }

  for (const envName of privateKeyEnvNames) {
    const envPrivateKey = normalizePrivateKey(process.env[envName]);
    if (envPrivateKey) {
      return envPrivateKey;
    }
  }

  throw new Error(
    `Missing owner private key. Set one of ${privateKeyEnvNames.join(
      ", ",
    )} or pass --private-key.`,
  );
}

function getCanonicalHostAddress(user: DbUser) {
  const candidate =
    user.onchainAddress?.trim() || user.smartWalletAddress?.trim() || "";

  if (!candidate) {
    throw new Error(
      `User ${user.email} does not have onchainAddress or smartWalletAddress synced yet.`,
    );
  }

  if (!isAddress(candidate)) {
    throw new Error(`User ${user.email} has an invalid onchain address.`);
  }

  return getAddress(candidate) as Hex;
}

async function findUserByEmail(email: string) {
  const { client } = await import("../src/index.js");

  return client.collection<DbUser>("user").findOne({
    email: {
      $options: "i",
      $regex: `^${escapeRegex(email)}$`,
    },
  });
}

async function setUserAsOffchainHost(input: {
  user: DbUser;
  userAddress: Hex;
}) {
  const { client } = await import("../src/index.js");

  const result = await client.collection<DbUser>("user").updateOne(
    {
      email: {
        $options: "i",
        $regex: `^${escapeRegex(input.user.email)}$`,
      },
    },
    {
      $set: {
        onchainAddress: input.user.onchainAddress ?? input.userAddress,
        role: "host",
        smartWalletAddress:
          input.user.smartWalletAddress ?? input.user.onchainAddress,
        updatedAt: new Date(),
      },
    },
  );

  if (!result.matchedCount) {
    throw new Error(`User ${input.user.email} disappeared before DB update.`);
  }
}

async function grantOnchainHost(input: {
  dryRun: boolean;
  ownerPrivateKey: Hex;
  userAddress: Hex;
}) {
  const publicClient = createPublicClient({
    chain: polygonAmoyChain,
    transport: http(polygonAmoyChain.rpcUrls.default.http[0]),
  });
  const account = privateKeyToAccount(input.ownerPrivateKey);
  const walletClient = createWalletClient({
    account,
    chain: polygonAmoyChain,
    transport: http(polygonAmoyChain.rpcUrls.default.http[0]),
  });
  const contractAddress = polygonAmoyDeployment.eduProxy as Hex;
  const contractOwner = getAddress(
    (await publicClient.readContract({
      abi: xrdmImplementationAbi,
      address: contractAddress,
      functionName: "owner",
    })) as string,
  );
  const ownerAddress = getAddress(account.address);

  if (contractOwner !== ownerAddress) {
    throw new Error(
      `Private key is not the eduProxy owner. Contract owner is ${contractOwner}, key address is ${ownerAddress}.`,
    );
  }

  const chainHostAlreadyApproved = Boolean(
    await publicClient.readContract({
      abi: xrdmImplementationAbi,
      address: contractAddress,
      args: [input.userAddress],
      functionName: "isApprovedHost",
    }),
  );

  if (chainHostAlreadyApproved || input.dryRun) {
    return {
      chainHostAlreadyApproved,
      ownerAddress,
      txHash: undefined,
    };
  }

  const txHash = await walletClient.writeContract({
    abi: xrdmImplementationAbi,
    address: contractAddress,
    args: [input.userAddress],
    functionName: "addHackathonHost",
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });

  const chainHostApprovedAfterTx = Boolean(
    await publicClient.readContract({
      abi: xrdmImplementationAbi,
      address: contractAddress,
      args: [input.userAddress],
      functionName: "isApprovedHost",
    }),
  );

  if (!chainHostApprovedAfterTx) {
    throw new Error(
      "Onchain host registration transaction finished, but host status is still false.",
    );
  }

  return {
    chainHostAlreadyApproved,
    ownerAddress,
    txHash,
  };
}

async function grantHostByEmail() {
  if (hasFlag("--help") || hasFlag("-h")) {
    printUsage();
    return;
  }

  loadEnvFiles();

  const email = normalizeEmail(
    getArgValue("--email") ?? getPositionalArgs()[0],
  );
  const dryRun = hasFlag("--dry-run");

  if (!email) {
    throw new Error("Missing email. Example: bun run host person@example.com");
  }

  const user = await findUserByEmail(email);
  if (!user) {
    throw new Error(`No user found with email ${email}.`);
  }

  const userAddress = getCanonicalHostAddress(user);
  const ownerPrivateKey = getOwnerPrivateKey();
  const onchainResult = await grantOnchainHost({
    dryRun,
    ownerPrivateKey,
    userAddress,
  });

  if (!dryRun) {
    await setUserAsOffchainHost({ user, userAddress });
  }

  const plan: HostGrantPlan = {
    chainHostAlreadyApproved: onchainResult.chainHostAlreadyApproved,
    dryRun,
    email: user.email,
    offchainRoleAlreadyHost: user.role === "host",
    ownerAddress: onchainResult.ownerAddress,
    txHash: onchainResult.txHash,
    userAddress,
    userId: user._id,
  };

  console.log("Host grant result:");
  console.log(JSON.stringify(plan, null, 2));
}

try {
  await grantHostByEmail();
} finally {
  await mongoose.disconnect();
}
