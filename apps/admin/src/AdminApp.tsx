import { useLoginWithEmail, usePrivy } from "@privy-io/react-auth";
import {
  ArrowRight,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { DashboardApp } from "./App";
import {
  adminApi,
  exchangePrivySession,
  serverUrl,
  setAdminSessionToken,
  signOutServerSession,
} from "./api";
import type { AdminSnapshot } from "./data";

type AccessPhase = "error" | "forbidden" | "loading" | "ready" | "signed-out";

type AdminUser = {
  email: string;
  name: string;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to load the admin dashboard.";
}

function isForbiddenError(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "FORBIDDEN"
  ) {
    return true;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "data" in error &&
    typeof error.data === "object" &&
    error.data !== null &&
    "code" in error.data
  ) {
    return error.data.code === "FORBIDDEN";
  }

  return false;
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <main className="access-shell">
      <section className="access-card access-card-centered">
        <span className="access-icon">
          <LoaderCircle className="spinning" size={24} />
        </span>
        <p className="eyebrow">RDM Hack Admin</p>
        <h1>Verifying access</h1>
        <p>{message}</p>
      </section>
    </main>
  );
}

function AccessMessage({
  action,
  detail,
  icon,
  title,
}: {
  action: React.ReactNode;
  detail: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <main className="access-shell">
      <section className="access-card access-card-centered">
        <span className="access-icon">{icon}</span>
        <p className="eyebrow">RDM Hack Admin</p>
        <h1>{title}</h1>
        <p>{detail}</p>
        {action}
      </section>
    </main>
  );
}

function AdminLogin() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { ready } = usePrivy();
  const { loginWithCode, sendCode, state } = useLoginWithEmail({
    onError: (error) => setFormError(errorMessage(error)),
  });
  const isBusy =
    state.status === "sending-code" || state.status === "submitting-code";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    try {
      if (awaitingCode) {
        const normalizedCode = code.trim();
        if (normalizedCode.length < 4) {
          setFormError("Enter the verification code sent to your email.");
          return;
        }

        await loginWithCode({ code: normalizedCode });
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail || !normalizedEmail.includes("@")) {
        setFormError("Enter a valid admin email address.");
        return;
      }

      setEmail(normalizedEmail);
      await sendCode({ email: normalizedEmail });
      setAwaitingCode(true);
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

  return (
    <main className="access-shell">
      <section className="access-card">
        <div className="access-brand">
          <span className="brand-mark">R</span>
          <span>
            <strong>RDM Hack</strong>
            <small>Founder analytics console</small>
          </span>
        </div>

        <div className="access-heading">
          <span className="access-icon">
            <LockKeyhole size={22} />
          </span>
          <div>
            <p className="eyebrow">Restricted workspace</p>
            <h1>Admin sign in</h1>
            <p>Use an email authorized in the server admin allowlist.</p>
          </div>
        </div>

        <form className="access-form" onSubmit={handleSubmit}>
          <label>
            Email
            <span>
              <Mail size={16} />
              <input
                autoComplete="email"
                disabled={awaitingCode}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="founder@company.com"
                type="email"
                value={email}
              />
            </span>
          </label>

          {awaitingCode ? (
            <label>
              Verification code
              <span>
                <KeyRound size={16} />
                <input
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={12}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="123456"
                  value={code}
                />
              </span>
            </label>
          ) : null}

          {formError ? <p className="access-error">{formError}</p> : null}

          <button disabled={!ready || isBusy} type="submit">
            {isBusy ? <LoaderCircle className="spinning" size={17} /> : <ArrowRight size={17} />}
            {state.status === "sending-code"
              ? "Sending code"
              : state.status === "submitting-code"
                ? "Verifying"
                : awaitingCode
                  ? "Verify and continue"
                  : "Send email code"}
          </button>

          {awaitingCode ? (
            <button
              className="access-secondary"
              onClick={() => {
                setAwaitingCode(false);
                setCode("");
                setFormError(null);
              }}
              type="button"
            >
              Use another email
            </button>
          ) : null}
        </form>

        <div className="access-footnote">
          <span className="readonly-dot" />
          <span>Read-only production visibility</span>
        </div>
      </section>
    </main>
  );
}

export function AdminApp() {
  const { authenticated, getAccessToken, logout, ready, user } = usePrivy();
  const [phase, setPhase] = useState<AccessPhase>("loading");
  const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const syncInFlightRef = useRef(false);

  const loadDashboard = useCallback(
    async (background = false, establishSession = true) => {
      if (syncInFlightRef.current) {
        return;
      }

      syncInFlightRef.current = true;
      setAccessError(null);
      if (background) {
        setIsRefreshing(true);
      } else {
        setPhase("loading");
      }

      try {
        const accessToken = await getAccessToken();
        if (!accessToken) {
          throw new Error("Privy did not provide an access token.");
        }

        if (establishSession) {
          const session = await exchangePrivySession(accessToken);
          setAdminSessionToken(session.token);
        }
        const [access, dashboard] = await Promise.all([
          adminApi.admin.access.query(),
          adminApi.admin.dashboard.query(),
        ]);

        setAdminUser(access.user);
        setSnapshot({
          ...dashboard,
          serverUrl,
        });
        setPhase("ready");
      } catch (error) {
        const message = errorMessage(error);
        setAccessError(message);
        setPhase(isForbiddenError(error) ? "forbidden" : "error");
      } finally {
        syncInFlightRef.current = false;
        setIsRefreshing(false);
      }
    },
    [getAccessToken],
  );

  useEffect(() => {
    if (!ready) {
      return;
    }

    if (!authenticated) {
      setAdminSessionToken(null);
      setAdminUser(null);
      setSnapshot(null);
      setPhase("signed-out");
      return;
    }

    void loadDashboard();
  }, [authenticated, loadDashboard, ready]);

  useEffect(() => {
    if (phase !== "ready") {
      return;
    }

    const refreshTimer = window.setInterval(() => {
      void loadDashboard(true, false);
    }, 30_000);

    return () => window.clearInterval(refreshTimer);
  }, [loadDashboard, phase]);

  async function handleSignOut() {
    setPhase("loading");
    await Promise.allSettled([logout(), signOutServerSession()]);
    setAdminSessionToken(null);
    setAdminUser(null);
    setSnapshot(null);
    setPhase("signed-out");
  }

  if (!ready || phase === "loading") {
    return <LoadingScreen message="Checking your session and server permissions." />;
  }

  if (!authenticated || phase === "signed-out") {
    return <AdminLogin />;
  }

  if (phase === "forbidden") {
    return (
      <AccessMessage
        action={
          <button className="access-action" onClick={() => void handleSignOut()} type="button">
            Sign out
          </button>
        }
        detail={`${user?.email?.address ?? "This account"} is signed in but is not listed in ADMIN_ALLOWED_EMAILS.`}
        icon={<ShieldAlert size={24} />}
        title="Access not allowed"
      />
    );
  }

  if (phase === "error" || !snapshot || !adminUser) {
    return (
      <AccessMessage
        action={
          <div className="access-actions">
            <button className="access-action" onClick={() => void loadDashboard()} type="button">
              <RefreshCw size={16} />
              Retry
            </button>
            <button
              className="access-action access-action-muted"
              onClick={() => void handleSignOut()}
              type="button"
            >
              Sign out
            </button>
          </div>
        }
        detail={accessError ?? "The analytics server could not be reached."}
        icon={<ShieldAlert size={24} />}
        title="Dashboard unavailable"
      />
    );
  }

  return (
      <DashboardApp
      adminUser={adminUser}
      isRefreshing={isRefreshing}
      onRefresh={() => void loadDashboard(true, false)}
      onSignOut={() => void handleSignOut()}
      snapshot={snapshot}
    />
  );
}
