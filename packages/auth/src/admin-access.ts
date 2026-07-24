export function normalizeAdminEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isAdminEmailAllowed(email: string, allowedEmails: readonly string[]) {
  const normalizedEmail = normalizeAdminEmail(email);

  if (!normalizedEmail) {
    return false;
  }

  return allowedEmails.some((allowedEmail) => normalizeAdminEmail(allowedEmail) === normalizedEmail);
}

export function isAdminExchangeAllowed(
  audience: string | undefined,
  email: string,
  allowedEmails: readonly string[],
) {
  return audience === "admin" && isAdminEmailAllowed(email, allowedEmails);
}
