const PRIVY_SESSION_STORAGE_KEY = "rdm-hack.privy-session";
const PRIVY_SIGN_OUT_STORAGE_KEY = "rdm-hack.privy-signing-out";
const AUTH_STORAGE_KEY_PATTERNS = ["rdm-hack", "privy", "better-auth"];
const AUTH_COOKIE_PATTERNS = ["better-auth", "rdm-hack", "privy"];

export type AppPrivySessionUser = {
  embeddedWalletAddress?: string;
  email: string;
  id: string;
  name: string;
  onchainAddress?: string;
  privyUserId: string;
  smartWalletAddress?: string;
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

function clearAuthKeys(storage: Storage | null) {
  if (!storage) {
    return;
  }

  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);

    if (!key) {
      continue;
    }

    const normalizedKey = key.toLowerCase();

    if (AUTH_STORAGE_KEY_PATTERNS.some((pattern) => normalizedKey.includes(pattern))) {
      storage.removeItem(key);
    }
  }
}

function clearAuthCookies() {
  if (typeof document === "undefined") {
    return;
  }

  const hostParts = window.location.hostname.split(".");
  const domainCandidates = hostParts.flatMap((_, index) => {
    const domain = hostParts.slice(index).join(".");
    return domain ? [domain, `.${domain}`] : [];
  });

  for (const cookie of document.cookie.split(";")) {
    const [rawName] = cookie.trim().split("=");
    if (!rawName) {
      continue;
    }

    const normalizedName = rawName.toLowerCase();
    if (!AUTH_COOKIE_PATTERNS.some((pattern) => normalizedName.includes(pattern))) {
      continue;
    }

    document.cookie = `${rawName}=; Max-Age=0; path=/`;
    for (const domain of domainCandidates) {
      document.cookie = `${rawName}=; Max-Age=0; path=/; domain=${domain}`;
    }
  }
}

export function setPrivyAccessToken(token: string | null) {
  accessToken = token?.trim() || null;
}

export function getPrivyAccessToken() {
  return accessToken;
}

export function readStoredPrivySession(): AppPrivySession | null {
  if (isPrivySignOutPending()) {
    return null;
  }

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
  if (isPrivySignOutPending()) {
    return;
  }

  getStorage()?.setItem(PRIVY_SESSION_STORAGE_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event("rdm-privy-session-change"));
}

export function clearStoredPrivySession() {
  accessToken = null;
  getStorage()?.removeItem(PRIVY_SESSION_STORAGE_KEY);
  window.dispatchEvent(new Event("rdm-privy-session-change"));
}

export function beginPrivySignOut() {
  getStorage()?.setItem(PRIVY_SIGN_OUT_STORAGE_KEY, "true");
  clearStoredPrivySession();
}

export function clearPrivySignOut() {
  getStorage()?.removeItem(PRIVY_SIGN_OUT_STORAGE_KEY);
}

export function isPrivySignOutPending() {
  return getStorage()?.getItem(PRIVY_SIGN_OUT_STORAGE_KEY) === "true";
}

export function clearBrowserAuthStorageForSignOut() {
  accessToken = null;
  clearAuthKeys(typeof window === "undefined" ? null : window.localStorage);
  clearAuthKeys(typeof window === "undefined" ? null : window.sessionStorage);
  clearAuthCookies();
  getStorage()?.setItem(PRIVY_SIGN_OUT_STORAGE_KEY, "true");
  window.dispatchEvent(new Event("rdm-privy-session-change"));
}
