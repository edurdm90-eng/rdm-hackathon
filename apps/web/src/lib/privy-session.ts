const PRIVY_SESSION_STORAGE_KEY = "rdm-hack.privy-session";

export type AppPrivySessionUser = {
  email: string;
  id: string;
  name: string;
  privyUserId: string;
  walletAddress?: string;
};

export type AppPrivySession = {
  session: {
    id: string;
  };
  user: AppPrivySessionUser;
};

let accessToken: string | null = null;

function getStorage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function setPrivyAccessToken(token: string | null) {
  accessToken = token?.trim() || null;
}

export function getPrivyAccessToken() {
  return accessToken;
}

export function readStoredPrivySession(): AppPrivySession | null {
  const rawSession = getStorage()?.getItem(PRIVY_SESSION_STORAGE_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as AppPrivySession;
  } catch {
    getStorage()?.removeItem(PRIVY_SESSION_STORAGE_KEY);
    return null;
  }
}

export function writeStoredPrivySession(session: AppPrivySession) {
  getStorage()?.setItem(PRIVY_SESSION_STORAGE_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event("rdm-privy-session-change"));
}

export function clearStoredPrivySession() {
  accessToken = null;
  getStorage()?.removeItem(PRIVY_SESSION_STORAGE_KEY);
  window.dispatchEvent(new Event("rdm-privy-session-change"));
}
