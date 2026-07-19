import * as SecureStore from "expo-secure-store";

type PendingChainEvent = {
  createdAt: string;
  id: string;
  kind: string;
  txHash?: string;
};

const pendingChainEventsKey = "rdm.pendingChainEvents";

async function readPendingChainEvents() {
  const raw = await SecureStore.getItemAsync(pendingChainEventsKey);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Array<PendingChainEvent>) : [];
  } catch {
    return [];
  }
}

export async function rememberPendingChainEvent(input: {
  id: string;
  kind: string;
  txHash?: string;
}) {
  const pending = await readPendingChainEvents();
  const next = [
    ...pending.filter((event) => event.id !== input.id),
    {
      createdAt: new Date().toISOString(),
      id: input.id,
      kind: input.kind,
      txHash: input.txHash,
    },
  ];

  await SecureStore.setItemAsync(pendingChainEventsKey, JSON.stringify(next.slice(-50)));
}

export async function forgetPendingChainEvent(id: string) {
  const pending = await readPendingChainEvents();
  const next = pending.filter((event) => event.id !== id);

  await SecureStore.setItemAsync(pendingChainEventsKey, JSON.stringify(next));
}
