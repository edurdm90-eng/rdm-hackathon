export function getWebPrivyAppId() {
  return (import.meta.env.VITE_PRIVY_APP_ID as string | undefined) ?? "";
}

export function getWebPrivyConfigurationError() {
  if (!getWebPrivyAppId()) {
    return "VITE_PRIVY_APP_ID is not configured yet. Add it when the Privy credentials arrive.";
  }

  return null;
}
