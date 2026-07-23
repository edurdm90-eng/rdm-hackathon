import { Ionicons } from "@expo/vector-icons";
import { useLoginWithEmail, usePrivy } from "@privy-io/expo";
import { useSmartWallets } from "@privy-io/expo/smart-wallets";
import { LOGIN_RESTRICTION_BLOCK_MESSAGE } from "@rdm-hack/auth/client";
import { polygonAmoyDeployment } from "@rdm-hack/blockchain-client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import type React from "react";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import { useNativePrivyBridge } from "@/components/privy-provider";
import {
  AppHeader,
  Avatar,
  EmptyState,
  ErrorBanner,
  Field,
  FullScreenLoader,
  HackButton,
  HackTextInput,
  HomeHubTile,
  MetricCard,
  Panel,
  ProfileRow,
  RoomCard,
  StatusBanner,
  SubmissionCard,
} from "@/components/hack-room/components";
import {
  HackRoomDashboard,
  HackRoomDetailDashboard,
} from "@/components/hack-room/room-detail";
import { userFacingActionError } from "@/components/hack-room/blockchain-hooks";
import { HACK_THEME as theme } from "@/lib/constants";
import {
  countNativeNetworkParticipants,
  firstName,
  formatShortDateTime,
  notificationBannerMessage,
  type ParticipantTab,
  type SessionUser,
  type Tone,
} from "@/components/hack-room/domain";
import { styles } from "@/components/hack-room/styles";
import { queryClient, trpc } from "@/utils/trpc";

const rdmLogo = require("@/assets/logo/rdm-logo.png");

const privyEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
});

const privyCodeSchema = privyEmailSchema.extend({
  code: z
    .string()
    .trim()
    .min(4, "Enter the code from your email")
    .max(12, "Code is too long"),
});

const LOGIN_EMAIL_HINT = "Please use ONLY your registered email";
const LOGIN_EMAIL_UNAUTHORIZED_MESSAGE =
  "Your mail-id is unauthorized, contact Admin";
const LOGIN_EMAIL_CHECK_FAILED_MESSAGE =
  "Unable to check your registered email. Please try again.";

const walletSyncRetryDelaysMs = [0, 800, 1_600, 3_200, 6_400, 10_000] as const;
let cachedNativeSessionUser: SessionUser | null = null;
const syncedWalletKeys = new Set<string>();
let cachedAuthGatewayState = {
  code: "",
  email: "",
  hasSentCode: false,
};

function walletProfileValue(
  value: string | null | undefined,
  fallback = "Not synced yet",
) {
  return value && value.trim().length > 0 ? value : fallback;
}

function loginEmailPrecheckErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (
    message === LOGIN_RESTRICTION_BLOCK_MESSAGE ||
    message === LOGIN_EMAIL_UNAUTHORIZED_MESSAGE ||
    message.includes("FORBIDDEN")
  ) {
    return LOGIN_EMAIL_UNAUTHORIZED_MESSAGE;
  }

  return message || LOGIN_EMAIL_CHECK_FAILED_MESSAGE;
}

function waitForWalletSyncRetry(delayMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function setCachedNativeSessionUser(user: SessionUser | null) {
  cachedNativeSessionUser = user;
}

function resetCachedAuthGatewayState() {
  cachedAuthGatewayState = {
    code: "",
    email: "",
    hasSentCode: false,
  };
}

function useSponsoredWalletSync(user: SessionUser | null) {
  const { walletAddress } = useNativePrivyBridge();
  const { client: readySmartWalletClient, getClientForChain } =
    useSmartWallets();
  const syncWallets = useMutation(trpc.hackRoom.syncWallets.mutationOptions());

  useEffect(() => {
    if (!user || !walletAddress || syncWallets.isPending) {
      return;
    }

    let cancelled = false;
    const sessionUser = user;
    const embeddedWalletAddress = walletAddress;

    async function syncWalletsForUser() {
      const embeddedSyncKey = `${sessionUser.id}:${embeddedWalletAddress}:embedded`;

      if (!syncedWalletKeys.has(embeddedSyncKey)) {
        syncedWalletKeys.add(embeddedSyncKey);
        await syncWallets.mutateAsync({
          embeddedWalletAddress,
        });
        await queryClient.invalidateQueries({
          queryKey: trpc.hackRoom.dashboard.queryKey(),
        });
      }

      for (const delayMs of walletSyncRetryDelaysMs) {
        if (cancelled) {
          return;
        }

        if (delayMs > 0) {
          await waitForWalletSyncRetry(delayMs);
        }

        let smartWalletAddress = "";

        try {
          const smartWalletClient =
            readySmartWalletClient ??
            (await getClientForChain({
              chainId: polygonAmoyDeployment.chainId,
            }));
          smartWalletAddress = (
            smartWalletClient.account?.address ?? ""
          ).toString();
        } catch {
          continue;
        }

        if (!smartWalletAddress) {
          continue;
        }

        const smartSyncKey = `${sessionUser.id}:${embeddedWalletAddress}:${smartWalletAddress}`;
        if (syncedWalletKeys.has(smartSyncKey) || cancelled) {
          return;
        }

        syncedWalletKeys.add(smartSyncKey);
        await syncWallets.mutateAsync({
          embeddedWalletAddress,
          smartWalletAddress,
        });
        await queryClient.invalidateQueries({
          queryKey: trpc.hackRoom.dashboard.queryKey(),
        });
        return;
      }
    }

    void syncWalletsForUser().catch(() => {
      syncedWalletKeys.delete(
        `${sessionUser.id}:${embeddedWalletAddress}:embedded`,
      );
    });

    return () => {
      cancelled = true;
    };
  }, [
    getClientForChain,
    readySmartWalletClient,
    syncWallets,
    user,
    walletAddress,
  ]);
}

export function NativeHomeScreen() {
  return (
    <AuthenticatedRoute>
      {(user) => <HomeDashboard user={user} />}
    </AuthenticatedRoute>
  );
}

export function AuthenticatedTabs({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  if (session?.user) {
    setCachedNativeSessionUser(session.user);
  }
  const sessionUser = session?.user ?? cachedNativeSessionUser;
  useSponsoredWalletSync(sessionUser);

  if (isPending && !sessionUser) {
    return <FullScreenLoader message="Opening your workspace..." />;
  }

  if (!sessionUser) {
    return <AuthGateway />;
  }

  return children;
}

export function HackRoomHome() {
  return <HackRoomScreen />;
}

export function HackRoomScreen() {
  return (
    <AuthenticatedRoute>
      {(user) => <HackRoomDashboard user={user} />}
    </AuthenticatedRoute>
  );
}

export function HackRoomDetailScreen({
  initialParticipantTab = null,
  roomId,
}: {
  initialParticipantTab?: ParticipantTab | null;
  roomId: string;
}) {
  return (
    <AuthenticatedRoute>
      {(user) => (
        <HackRoomDetailDashboard
          initialParticipantTab={initialParticipantTab}
          roomId={roomId}
          user={user}
        />
      )}
    </AuthenticatedRoute>
  );
}

export function ProfileScreen() {
  return (
    <AuthenticatedRoute>
      {(user) => <ProfileDashboard user={user} />}
    </AuthenticatedRoute>
  );
}

function AuthenticatedRoute({
  children,
}: {
  children: (user: SessionUser) => React.ReactNode;
}) {
  const { data: session, isPending } = authClient.useSession();
  if (session?.user) {
    setCachedNativeSessionUser(session.user);
  }
  const sessionUser = session?.user ?? cachedNativeSessionUser;
  useSponsoredWalletSync(sessionUser);

  if (isPending && !sessionUser) {
    return <FullScreenLoader message="Opening your workspace..." />;
  }

  if (!sessionUser) {
    return <AuthGateway />;
  }

  return children(sessionUser);
}

function AuthGateway() {
  const { isReady, user } = usePrivy();
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const { clearLastError, isSyncing, lastError, retrySync } =
    useNativePrivyBridge();
  const checkLoginEmail = useMutation(
    trpc.auth.checkLoginEmail.mutationOptions(),
  );
  const [email, setEmail] = useState(cachedAuthGatewayState.email);
  const [code, setCode] = useState(cachedAuthGatewayState.code);
  const [hasSentCode, setHasSentCode] = useState(
    cachedAuthGatewayState.hasSentCode,
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const displayLastError =
    lastError === LOGIN_RESTRICTION_BLOCK_MESSAGE
      ? LOGIN_EMAIL_UNAUTHORIZED_MESSAGE
      : lastError;

  useEffect(() => {
    cachedAuthGatewayState = {
      code,
      email,
      hasSentCode,
    };
  }, [code, email, hasSentCode]);

  useEffect(() => {
    if (lastError === LOGIN_RESTRICTION_BLOCK_MESSAGE) {
      setCode("");
      setHasSentCode(false);
    }
  }, [lastError]);

  const resetError = () => {
    if (formError) {
      setFormError(null);
    }
    if (lastError) {
      clearLastError();
    }
  };

  const handleSendCode = async () => {
    const parsed = privyEmailSchema.safeParse({ email });

    if (!parsed.success) {
      setFormError(
        parsed.error.issues[0]?.message ?? "Enter a valid email address",
      );
      return;
    }

    setIsRequestingCode(true);
    setFormError(null);
    clearLastError();

    try {
      await checkLoginEmail.mutateAsync({ email: parsed.data.email });
    } catch (error) {
      setIsRequestingCode(false);
      setFormError(loginEmailPrecheckErrorMessage(error));
      return;
    }

    try {
      await sendCode({ email: parsed.data.email });
      setEmail(parsed.data.email);
      setHasSentCode(true);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Unable to send an email code.",
      );
    } finally {
      setIsRequestingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    const parsed = privyCodeSchema.safeParse({ code, email });

    if (!parsed.success) {
      setFormError(
        parsed.error.issues[0]?.message ?? "Enter the code from your email",
      );
      return;
    }

    setIsVerifyingCode(true);
    setFormError(null);
    clearLastError();

    try {
      await loginWithCode({
        code: parsed.data.code,
        email: parsed.data.email,
      });
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Unable to verify the email code.",
      );
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const isCheckingEmail = checkLoginEmail.isPending;
  const isBusy =
    isCheckingEmail || isRequestingCode || isVerifyingCode || isSyncing;
  const isPrivyAuthenticated = Boolean(user);
  const shouldShowLoginEmailHint =
    !hasSentCode && !isPrivyAuthenticated && !formError && !displayLastError;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.authScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.authBrandBlock}>
          <View style={styles.authLogoFrame}>
            <Image
              accessibilityIgnoresInvertColors
              resizeMode="contain"
              source={rdmLogo}
              style={styles.authLogo}
            />
          </View>
          <View style={styles.authBrandText}>
            <Text style={styles.authEyebrow}>RDM Hack Room</Text>
            <Text style={styles.authHeadline}>Welcome back</Text>
          </View>
        </View>

        <View style={styles.authCard}>
          <View style={styles.authCardHeader}>
            <View style={styles.authIconBadge}>
              <Ionicons
                name="mail-unread-outline"
                size={20}
                color={theme.participant}
              />
            </View>
            <View style={styles.authTitleBlock}>
              <Text style={styles.formTitle}>Email access</Text>
            </View>
          </View>

          {!isReady ? (
            <StatusBanner message="Preparing secure sign-in..." tone="cyan" />
          ) : null}
          {isPrivyAuthenticated && isSyncing ? (
            <StatusBanner
              message="Creating your Hack Room session..."
              tone="violet"
            />
          ) : null}
          {formError ? <ErrorBanner message={formError} /> : null}
          {displayLastError ? <ErrorBanner message={displayLastError} /> : null}

          <Field label="Email">
            <HackTextInput
              autoCapitalize="none"
              editable={!hasSentCode && !isPrivyAuthenticated && !isBusy}
              keyboardType="email-address"
              onChangeText={(value) => {
                setEmail(value);
                resetError();
              }}
              onSubmitEditing={handleSendCode}
              placeholder="you@example.com"
              style={styles.authInput}
              value={email}
            />
          </Field>

          {hasSentCode ? (
            <Field label="Email code">
              <HackTextInput
                autoCapitalize="none"
                editable={!isPrivyAuthenticated && !isBusy}
                keyboardType="number-pad"
                onChangeText={(value) => {
                  setCode(value);
                  resetError();
                }}
                onSubmitEditing={handleVerifyCode}
                placeholder="123456"
                style={styles.authInput}
                value={code}
              />
            </Field>
          ) : null}

          {hasSentCode ? (
            <HackButton
              disabled={
                !isReady || !code.trim() || isBusy || isPrivyAuthenticated
              }
              icon="checkmark-circle-outline"
              label={isSyncing ? "Syncing Session" : "Verify Code"}
              loading={isVerifyingCode || isSyncing}
              onPress={handleVerifyCode}
              tone="cyan"
            />
          ) : (
            <HackButton
              disabled={!isReady || !email.trim() || isBusy}
              icon="mail-outline"
              label="Send Email Code"
              loading={isRequestingCode}
              onPress={handleSendCode}
              tone="cyan"
            />
          )}

          {shouldShowLoginEmailHint ? (
            <Text
              style={[
                styles.authVerifiedAccountText,
                styles.authRegisteredEmailHintText,
              ]}
            >
              {LOGIN_EMAIL_HINT}
            </Text>
          ) : null}

          {hasSentCode || isPrivyAuthenticated ? (
            <View style={styles.authSecondaryActions}>
              {lastError ? (
                <HackButton
                  disabled={isSyncing}
                  icon="refresh-outline"
                  label="Retry Session"
                  loading={isSyncing}
                  onPress={() => {
                    void retrySync();
                  }}
                  tone="violet"
                />
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function HomeDashboard({ user }: { user: SessionUser }) {
  const router = useRouter();
  const dashboard = useQuery(trpc.hackRoom.dashboard.queryOptions());
  const [message, setMessage] = useState<{ text: string; tone: Tone } | null>(
    null,
  );
  const isInitialDashboardLoading = dashboard.isLoading && !dashboard.data;
  const isBackgroundDashboardSyncing =
    dashboard.isFetching && Boolean(dashboard.data);
  const stats = dashboard.data?.stats;
  const hostedRooms = dashboard.data?.hostedRooms ?? [];
  const joinedRooms = dashboard.data?.joinedRooms ?? [];
  const recentSubmissions = dashboard.data?.mySubmissions ?? [];
  const notifications = dashboard.data?.notifications ?? [];
  const walletRoom = joinedRooms[0];

  const handleNotifications = () => {
    setMessage({
      text: notificationBannerMessage(notifications),
      tone: notifications.length ? "violet" : "cyan",
    });
  };

  const openWallet = () => {
    if (!walletRoom) {
      router.push("/hack-room");
      return;
    }

    router.push({
      pathname: "/hack-room/[roomId]",
      params: { roomId: walletRoom._id, tab: "wallet" },
    });
  };

  if (isInitialDashboardLoading) {
    return <FullScreenLoader message="Loading your workspace..." />;
  }

  return (
    <View style={styles.screen}>
      <AppHeader
        notificationCount={notifications.length}
        onNotificationPress={handleNotifications}
      />
      <ScrollView
        contentContainerStyle={styles.dashboardContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.dashboardHero}>
          <Text style={styles.dashboardHeadline}>Home Hub</Text>
          <Text style={styles.dashboardCopy}>
            Welcome back, {firstName(user.name)}. Your room activity, pending
            reviews, and XRDM progress live here.
          </Text>

          <View style={styles.homeRoleTabs}>
            <View style={[styles.homeRoleTab, styles.homeRoleTabParticipant]}>
              <Ionicons
                name="person-outline"
                size={14}
                color={theme.participant}
              />
              <Text
                style={[
                  styles.homeRoleTabText,
                  styles.homeRoleTabTextParticipant,
                ]}
              >
                As Member
              </Text>
            </View>
            <View style={[styles.homeRoleTab, styles.homeRoleTabHost]}>
              <Ionicons name="trophy-outline" size={14} color={theme.host} />
              <Text
                style={[styles.homeRoleTabText, styles.homeRoleTabTextHost]}
              >
                As Organizer
              </Text>
            </View>
          </View>

          <View style={styles.profileCard}>
            <Avatar name={user.name} tone="cyan" />
            <View style={styles.profileText}>
              <Text style={styles.profileName}>{user.name}</Text>
              <Text style={styles.profileEmail}>{user.email}</Text>
            </View>
            {isBackgroundDashboardSyncing ? (
              <ActivityIndicator color={theme.award} />
            ) : null}
          </View>

          <View style={styles.metricsGrid}>
            <MetricCard
              icon="shield-checkmark-outline"
              label="Hosted"
              tone="violet"
              value={stats?.activeRooms ?? 0}
            />
            <MetricCard
              icon="enter-outline"
              label="Joined"
              tone="cyan"
              value={stats?.joinedRooms ?? 0}
            />
            <MetricCard
              icon="hourglass-outline"
              label="Reviews"
              tone="gold"
              value={stats?.pendingSubmissions ?? 0}
            />
          </View>

          <View style={styles.homeHubGrid}>
            <HomeHubTile
              icon="clipboard-outline"
              label="Assignments"
              meta="Due and past work"
              onPress={() => router.push("/hack-room")}
              tone="cyan"
            />
            <HomeHubTile
              icon="flash-outline"
              label="Spot Challenge"
              meta="Live room prompts"
              onPress={() => router.push("/hack-room")}
              tone="orange"
            />
            <HomeHubTile
              icon="game-controller-outline"
              label="Games"
              meta="Play mini games"
              onPress={() => router.push("/hack-room")}
              tone="lime"
            />
            <HomeHubTile
              icon="diamond-outline"
              label="Wallet"
              meta="XRDM, certs, NFTs"
              onPress={openWallet}
              tone="gold"
            />
          </View>
        </View>

        {dashboard.error ? (
          <ErrorBanner message={dashboard.error.message} />
        ) : null}
        {message ? (
          <StatusBanner message={message.text} tone={message.tone} />
        ) : null}

        <Panel
          eyebrow="Overview"
          icon="grid-outline"
          title="Hack Room Snapshot"
          tone="cyan"
        >
          <View style={styles.listStack}>
            {joinedRooms.length || hostedRooms.length ? (
              <>
                {hostedRooms.slice(0, 2).map((room) => (
                  <RoomCard key={room._id} role="host" room={room} />
                ))}
                {joinedRooms.slice(0, 2).map((room) => (
                  <RoomCard key={room._id} role="member" room={room} />
                ))}
              </>
            ) : (
              <EmptyState
                icon="home-outline"
                text="Create or join a hack room from the Hack Room tab to start seeing activity here."
              />
            )}
          </View>
        </Panel>

        <Panel
          eyebrow="Proof"
          icon="checkmark-circle-outline"
          title="Recent Submissions"
          tone="gold"
        >
          <View style={styles.listStack}>
            {recentSubmissions.length ? (
              recentSubmissions
                .slice(0, 2)
                .map((submission) => (
                  <SubmissionCard
                    key={submission._id}
                    submission={submission}
                  />
                ))
            ) : (
              <EmptyState
                icon="checkmark-circle-outline"
                text="Your submitted proof records will appear here after you complete a task."
              />
            )}
          </View>
        </Panel>
      </ScrollView>
    </View>
  );
}

function ProfileDashboard({ user }: { user: SessionUser }) {
  const dashboard = useQuery(trpc.hackRoom.dashboard.queryOptions());
  const { logout } = usePrivy();
  const { isCreatingWallet, retryCreateWallet, walletAddress, walletError } =
    useNativePrivyBridge();
  const [message, setMessage] = useState<{ text: string; tone: Tone } | null>(
    null,
  );
  const isInitialDashboardLoading = dashboard.isLoading && !dashboard.data;
  const isBackgroundDashboardSyncing =
    dashboard.isFetching && Boolean(dashboard.data);
  const stats = dashboard.data?.stats;
  const wallets = dashboard.data?.wallets;
  const hostedRooms = dashboard.data?.hostedRooms ?? [];
  const notifications = dashboard.data?.notifications ?? [];
  const networkCount = countNativeNetworkParticipants(hostedRooms, user);
  const role = dashboard.data?.viewerRole ?? "member";
  const showNetworkMetric = false;
  const showTechnicalProfileDetails = false;
  const embeddedWalletAddress = wallets?.embeddedWalletAddress ?? walletAddress;
  const walletFallback = isCreatingWallet
    ? "Setting up account..."
    : "Not synced yet";
  const accountSetupError = walletError
    ? userFacingActionError(
        new Error(walletError),
        "Account setup is still finishing. Please try again.",
      )
    : null;

  const handleSignOut = async () => {
    setCachedNativeSessionUser(null);
    resetCachedAuthGatewayState();
    await Promise.allSettled([authClient.signOut(), logout()]);
    await queryClient.invalidateQueries();
  };

  const handleNotifications = () => {
    setMessage({
      text: notificationBannerMessage(notifications),
      tone: notifications.length ? "violet" : "cyan",
    });
  };

  if (isInitialDashboardLoading) {
    return <FullScreenLoader message="Loading your profile..." />;
  }

  return (
    <View style={styles.screen}>
      <AppHeader
        notificationCount={notifications.length}
        onNotificationPress={handleNotifications}
      />
      <ScrollView
        contentContainerStyle={styles.dashboardContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.dashboardHero}>
          <View style={styles.profileHero}>
            <Avatar name={user.name} tone="cyan" />
            <View style={styles.profileText}>
              <Text style={styles.dashboardHeadline}>{user.name}</Text>
              <Text style={styles.profileEmail}>{user.email}</Text>
            </View>
            {isBackgroundDashboardSyncing ? (
              <ActivityIndicator color={theme.award} />
            ) : null}
          </View>

          <View style={styles.metricsGrid}>
            <MetricCard
              icon="flash-outline"
              label="Rooms"
              tone="cyan"
              value={(stats?.activeRooms ?? 0) + (stats?.joinedRooms ?? 0)}
            />
            <MetricCard
              icon="trophy-outline"
              label="Wins"
              tone="gold"
              value={stats?.winners ?? 0}
            />
            {showNetworkMetric ? (
              <MetricCard
                icon="people-outline"
                label="Network"
                tone="violet"
                value={networkCount}
              />
            ) : null}
          </View>
        </View>

        {dashboard.error ? (
          <ErrorBanner message={dashboard.error.message} />
        ) : null}
        {message ? (
          <StatusBanner message={message.text} tone={message.tone} />
        ) : null}
        {accountSetupError ? <ErrorBanner message={accountSetupError} /> : null}

        <Panel
          eyebrow="Account"
          icon="person-circle-outline"
          title="Profile"
          tone="cyan"
        >
          <View style={styles.profileDetails}>
            <ProfileRow label="Name" value={user.name} />
            <ProfileRow label="Email" value={user.email} />
            <ProfileRow label="Role" value={role} />
            {showTechnicalProfileDetails ? (
              <>
                <ProfileRow label="User ID" value={user.id} />
                <ProfileRow
                  label="Login account"
                  value={walletProfileValue(
                    embeddedWalletAddress,
                    walletFallback,
                  )}
                />
                <ProfileRow
                  label="Rewards account"
                  value={walletProfileValue(
                    wallets?.smartWalletAddress,
                    walletFallback,
                  )}
                />
                <ProfileRow
                  label="Rewards address"
                  value={walletProfileValue(
                    wallets?.onchainAddress,
                    walletFallback,
                  )}
                />
              </>
            ) : null}
          </View>
          {accountSetupError ? (
            <HackButton
              icon="refresh-outline"
              label="Retry Setup"
              onPress={() => void retryCreateWallet()}
              tone="gold"
            />
          ) : null}
          <HackButton
            icon="log-out-outline"
            label="Sign Out"
            onPress={handleSignOut}
            tone="red"
          />
        </Panel>
      </ScrollView>
    </View>
  );
}
