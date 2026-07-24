const PRIVY_SESSION_STORAGE_KEY = "rdm-hack.privy-session";
const PRIVY_SIGN_OUT_STORAGE_KEY = "rdm-hack.privy-signing-out";
const DURABLE_SIGN_OUT_STORAGE_KEY = "xrdm.auth.signed-out";
const SIGNED_OUT_AT_STORAGE_KEY = "xrdm.auth.signed-out-at";
const ACTIVE_TAB_SESSION_STORAGE_KEY = "xrdm.auth.active-tab-session";
const SIGN_OUT_COOKIE_NAME = "xrdm_auth_signed_out";
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
  signedInAt?: number;
  user: AppPrivySessionUser;
};

let accessToken: string | null = null;

function getStorage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

function getTabStorage() {
  return typeof window === "undefined" ? null : window.sessionStorage;
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

function writeSignOutCookie() {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${SIGN_OUT_COOKIE_NAME}=true; Max-Age=31536000; path=/; SameSite=Lax`;
}

function clearSignOutCookie() {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${SIGN_OUT_COOKIE_NAME}=; Max-Age=0; path=/; SameSite=Lax`;
}

function hasSignOutCookie() {
  if (typeof document === "undefined") {
    return false;
  }

  return document.cookie
    .split(";")
    .some((cookie) => cookie.trim().startsWith(`${SIGN_OUT_COOKIE_NAME}=`));
}

function readLatestSignedOutAt() {
  const rawValue = getStorage()?.getItem(SIGNED_OUT_AT_STORAGE_KEY);
  const signedOutAt = rawValue ? Number(rawValue) : 0;

  return Number.isFinite(signedOutAt) ? signedOutAt : 0;
}

function recordSignedOut() {
  const storage = getStorage();

  storage?.setItem(DURABLE_SIGN_OUT_STORAGE_KEY, "true");
  storage?.setItem(SIGNED_OUT_AT_STORAGE_KEY, String(Date.now()));
  writeSignOutCookie();
}

function recordSignOut() {
  getStorage()?.setItem(PRIVY_SIGN_OUT_STORAGE_KEY, "true");
  recordSignedOut();
}

function isSessionAfterLatestSignOut(session: AppPrivySession) {
  const latestSignedOutAt = readLatestSignedOutAt();

  if (!latestSignedOutAt) {
    return true;
  }

  return typeof session.signedInAt === "number" && session.signedInAt > latestSignedOutAt;
}

function readActiveTabSignedInAt() {
  const rawValue = getTabStorage()?.getItem(ACTIVE_TAB_SESSION_STORAGE_KEY);
  const signedInAt = rawValue ? Number(rawValue) : 0;

  return Number.isFinite(signedInAt) ? signedInAt : 0;
}

function markActiveTabSession(signedInAt: number) {
  getTabStorage()?.setItem(ACTIVE_TAB_SESSION_STORAGE_KEY, String(signedInAt));
}

function clearActiveTabSession() {
  getTabStorage()?.removeItem(ACTIVE_TAB_SESSION_STORAGE_KEY);
}

function isSessionActiveInThisTab(session: AppPrivySession) {
  return (
    typeof session.signedInAt === "number" &&
    readActiveTabSignedInAt() === session.signedInAt
  );
}

export function setPrivyAccessToken(token: string | null) {
  accessToken = token?.trim() || null;
}

export function getPrivyAccessToken() {
  return accessToken;
}

export function readStoredPrivySession(): AppPrivySession | null {
  if (isPrivySignedOut()) {
    return null;
  }

  const rawSession = getStorage()?.getItem(PRIVY_SESSION_STORAGE_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    const session = JSON.parse(rawSession) as AppPrivySession;

    if (!isSessionAfterLatestSignOut(session)) {
      getStorage()?.removeItem(PRIVY_SESSION_STORAGE_KEY);
      return null;
    }

    if (!isSessionActiveInThisTab(session)) {
      return null;
    }

    return session;
  } catch {
    getStorage()?.removeItem(PRIVY_SESSION_STORAGE_KEY);
    return null;
  }
}

export function writeStoredPrivySession(session: AppPrivySession) {
  if (isPrivySignedOut()) {
    return;
  }

  const nextSession = {
    ...session,
    signedInAt: session.signedInAt ?? Date.now(),
  };

  markActiveTabSession(nextSession.signedInAt);
  getStorage()?.setItem(PRIVY_SESSION_STORAGE_KEY, JSON.stringify(nextSession));
  window.dispatchEvent(new Event("rdm-privy-session-change"));
}

export function clearStoredPrivySession() {
  accessToken = null;
  clearActiveTabSession();
  getStorage()?.removeItem(PRIVY_SESSION_STORAGE_KEY);
  window.dispatchEvent(new Event("rdm-privy-session-change"));
}

export function beginPrivySignOut() {
  recordSignOut();
  clearStoredPrivySession();
}

export function clearPrivySignOut() {
  getStorage()?.removeItem(PRIVY_SIGN_OUT_STORAGE_KEY);
  getStorage()?.removeItem(DURABLE_SIGN_OUT_STORAGE_KEY);
  clearSignOutCookie();
}

export function isPrivySignOutPending() {
  return getStorage()?.getItem(PRIVY_SIGN_OUT_STORAGE_KEY) === "true";
}

export function isPrivySignedOut() {
  const storage = getStorage();

  return (
    storage?.getItem(PRIVY_SIGN_OUT_STORAGE_KEY) === "true" ||
    storage?.getItem(DURABLE_SIGN_OUT_STORAGE_KEY) === "true" ||
    hasSignOutCookie()
  );
}

export function readProtectedPrivySession(): AppPrivySession | null {
  if (isPrivySignedOut()) {
    clearBrowserAuthStorageForSignOut();
    return null;
  }

  return readStoredPrivySession();
}

export function clearBrowserAuthStorageForSignOut() {
  accessToken = null;
  clearAuthKeys(typeof window === "undefined" ? null : window.localStorage);
  clearAuthKeys(typeof window === "undefined" ? null : window.sessionStorage);
  clearAuthCookies();
  clearActiveTabSession();
  recordSignedOut();
  window.dispatchEvent(new Event("rdm-privy-session-change"));
}
