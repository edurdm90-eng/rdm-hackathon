import { describe, expect, test } from "bun:test";

import { resolveTransactionHashWithWaiters } from "./blockchain.ts";

const returnedHash =
  "0x1111111111111111111111111111111111111111111111111111111111111111";
const minedTxHash =
  "0x2222222222222222222222222222222222222222222222222222222222222222";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("resolveTransactionHashWithWaiters", () => {
  test("returns the original hash quickly when Privy already returns a transaction hash", async () => {
    let directReceiptChecks = 0;
    let userOperationChecks = 0;

    const start = Date.now();
    const resolvedHash = await resolveTransactionHashWithWaiters({
      hash: returnedHash,
      waitForTransactionReceipt: async () => {
        directReceiptChecks += 1;
      },
      waitForUserOperationReceipt: async () => {
        userOperationChecks += 1;
        await delay(100);
        return { receipt: { transactionHash: minedTxHash } };
      },
    });

    expect(resolvedHash).toBe(returnedHash);
    expect(directReceiptChecks).toBe(1);
    expect(userOperationChecks).toBe(1);
    expect(Date.now() - start).toBeLessThan(80);
  });

  test("still supports real UserOperation hashes", async () => {
    const resolvedHash = await resolveTransactionHashWithWaiters({
      hash: returnedHash,
      waitForTransactionReceipt: async () => {
        await delay(5);
        throw new Error("No transaction found for this hash");
      },
      waitForUserOperationReceipt: async () => ({
        receipt: { transactionHash: minedTxHash },
      }),
    });

    expect(resolvedHash).toBe(minedTxHash);
  });

  test("uses a direct receipt check when no smart-wallet receipt waiter exists", async () => {
    let directReceiptChecks = 0;

    const resolvedHash = await resolveTransactionHashWithWaiters({
      hash: returnedHash,
      waitForTransactionReceipt: async () => {
        directReceiptChecks += 1;
      },
    });

    expect(resolvedHash).toBe(returnedHash);
    expect(directReceiptChecks).toBe(1);
  });
});
