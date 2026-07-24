# RDM Hack Admin

Read-only founder analytics for RDM Hack. The app uses Privy email OTP for
identity, exchanges that identity for a Better Auth bearer session, and relies on
the server-side `ADMIN_ALLOWED_EMAILS` allowlist for authorization.

## Environment

Admin app (`apps/admin/.env`):

```dotenv
VITE_SERVER_URL=https://rdm-hack-server.vercel.app
VITE_PRIVY_APP_ID=your-privy-app-id
```

Server (`apps/server/.env` or deployment environment):

```dotenv
ADMIN_ALLOWED_EMAILS=founder@example.com,ops@example.com
CORS_ORIGIN=https://your-admin-domain.example
```

The admin deployment origin must also be configured as an allowed origin in the
Privy application. An empty `ADMIN_ALLOWED_EMAILS` value denies all admin access.

## Commands

```sh
bun run dev
bun run check-types
bun run build
```

The local app runs at `http://localhost:3002`. Available routes are `/overview`,
`/roles`, `/users`, `/hosts`, `/rooms`, `/rewards`, `/chain`, and `/operations`.
