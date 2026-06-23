# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
bun install

# Run all apps in development
bun run dev

# Run individual apps
bun run dev:web      # Web at http://localhost:5173
bun run dev:server   # Server at http://localhost:3000
bun run dev:native   # Expo mobile app

# Build all
bun run build

# Type checking across all packages
bun run check-types
```

There is no test suite; `check-types` is the primary correctness check.

## Architecture

This is a **Turborepo monorepo** using Bun as the package manager and runtime.

### Apps

- **`apps/server`** — Hono HTTP server. Mounts Better-Auth at `/api/auth/*` and tRPC at `/trpc/*`. Entry: `src/index.ts`. Run with `bun run --hot`.
- **`apps/web`** — React 19 SPA using Vite, TanStack Router (file-based routing in `src/routes/`), and TailwindCSS v4. Auth-protected routes live under `src/routes/_auth/`.
- **`apps/native`** — Expo (React Native) app using Expo Router (file-based routing in `app/`). Drawer + tab navigation: `app/(drawer)/(tabs)/`. The entire hack room UI is in a single large component: `components/hack-room.tsx`.

### Shared Packages

- **`packages/api`** — tRPC router definitions. `src/index.ts` exports `publicProcedure`, `protectedProcedure`, `router`. `src/routers/hack-room.ts` is the main domain router. `createContext` reads the Better-Auth session from the Hono request headers.
- **`packages/auth`** — Better-Auth instance configured with MongoDB adapter and the `@better-auth/expo` plugin.
- **`packages/db`** — Connects Mongoose to MongoDB and exports a raw MongoDB `client` (the `Collection` API, not Mongoose models). The `hack_rooms`, `hack_tasks`, `hack_submissions`, and `hack_rewards` collections are accessed directly in `packages/api/src/routers/hack-room.ts`.
- **`packages/env`** — Type-safe env validation via `@t3-oss/env-core`. Three entry points: `server`, `web` (VITE_ prefix), `native` (EXPO_PUBLIC_ prefix). Import from the matching entry point, never cross-env.
- **`packages/ui`** — Shared shadcn/ui primitives. Add new primitives with `npx shadcn@latest add <component> -c packages/ui`. Import as `@rdm-hack/ui/components/<name>`.

### Data Flow

Client (web or native) → tRPC batch HTTP link → Hono server → tRPC handler → `appRouter` in `packages/api` → MongoDB via `packages/db` client.

Authentication is cookie-based on web (`credentials: "include"`) and manually forwarded via `Cookie` header on native using `authClient.getCookie()` from `@better-auth/expo`.

### Domain Model

All IDs are string-prefixed UUIDs (`room_`, `task_`, `sub_`, `reward_`). Collections store ISO-8601 strings for all timestamps. The `hack_rooms` collection embeds participants inline. Submissions progress through statuses: `submitted → approved | winner | returned`.

### Environment Variables

Server (`apps/server/.env`):
- `DATABASE_URL` — MongoDB connection URI
- `DATABASE_NAME` — defaults to `rdm-hack`
- `BETTER_AUTH_SECRET` — min 32 chars
- `BETTER_AUTH_URL` — server base URL
- `CORS_ORIGIN` — web app URL

Web (`apps/web/.env`):
- `VITE_SERVER_URL` — server base URL

Native (`apps/native/.env`):
- `EXPO_PUBLIC_SERVER_URL` — server base URL

### Adding tRPC Procedures

Add procedures to `packages/api/src/routers/hack-room.ts` (or a new router file), register in `packages/api/src/routers/index.ts`. The `AppRouter` type is exported from the index and used by both web and native clients for end-to-end type safety.

### shadcn/ui Components

- Shared primitives: `npx shadcn@latest add <component> -c packages/ui`
- Web-only blocks: run the shadcn CLI from `apps/web`
- Native uses plain React Native components, not shadcn
