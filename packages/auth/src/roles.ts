export const userRoles = ["member", "host"] as const;

export type UserRole = (typeof userRoles)[number];

export function normalizeUserRole(value: unknown): UserRole {
  return value === "host" ? "host" : "member";
}

export function isUserRole(value: unknown): value is UserRole {
  return value === "member" || value === "host";
}
