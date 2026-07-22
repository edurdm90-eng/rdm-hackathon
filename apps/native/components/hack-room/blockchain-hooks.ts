import { useSmartWallets } from "@privy-io/expo/smart-wallets";
import { polygonAmoyDeployment } from "@rdm-hack/blockchain-client";

import { resolveTransactionHash, type ContractCall } from "@/lib/blockchain";
import { rememberPendingChainEvent } from "@/lib/pending-chain-events";

const technicalUiErrorPattern =
  /blockchain|bundler|entrypoint|gas|on-chain|paymaster|pimlico|prefund|privy|rpc|smart account|smart wallet|transaction hash|useroperation|wallet receipt/i;

export function userFacingActionError(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.trim();
  if (!message || technicalUiErrorPattern.test(message)) {
    return fallback;
  }

  return message;
}

export function useSponsoredHackathonTransactions() {
  const { getClientForChain } = useSmartWallets();

  const sendContractCalls = async (input: {
    calls: Array<ContractCall>;
    pendingId: string;
    pendingKind: string;
  }) => {
    if (!input.calls.length) {
      return null;
    }

    const smartWalletClient = await getClientForChain({
      chainId: polygonAmoyDeployment.chainId,
    });
    const smartWalletAddress = (
      smartWalletClient.account?.address ?? ""
    ).toString();

    if (!smartWalletAddress) {
      throw new Error(
        "Account setup is still finishing. Please try again shortly.",
      );
    }

    await rememberPendingChainEvent({
      id: input.pendingId,
      kind: input.pendingKind,
    });

    const operationHash = await smartWalletClient.sendTransaction({
      calls: input.calls,
    } as never);
    const txHash = await resolveTransactionHash({
      client: smartWalletClient,
      hash: operationHash,
    });

    await rememberPendingChainEvent({
      id: input.pendingId,
      kind: input.pendingKind,
      txHash,
    });

    return txHash;
  };

  return {
    sendContractCalls,
  };
}
