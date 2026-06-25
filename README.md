# RDM Hack

RDM Hack is a monorepo for the XRDM Hack Room experience. It includes a native Expo app, a Hono/tRPC server, Better Auth authentication, and MongoDB-backed Hack Room workflows for hosts and participants.

The current product focus is the native app in `apps/native`.

## What The App Does

Hack Room supports a complete room-based hackathon loop:

- Hosts create Hack Rooms and share invite codes.
- Participants join rooms with invite codes.
- Hosts create regular tasks, spot challenges, special tasks, and notifications from `Assignments`.
- Participants submit proof with required fields: student name, team name, description, GitHub/Drive links, and any other configured proof fields.
- Hosts verify, return, or award submissions.
- Hosts award XRDM from verified submissions and can search by team/student/email/assignment.
- Hosts issue certificates and NFT badge records from the awards/reward ledger flow.
- Participants track submission history and view wallet rewards.
- Hosts and participants can play lightweight in-app mini-games; games are play-only and do not create proof submissions.

## Tech Stack

- Bun workspaces and Turborepo
- TypeScript
- Expo Router and React Native
- React web app with Vite and TanStack Router
- Hono server
- tRPC API layer
- Better Auth
- MongoDB
- Shared packages for API, auth, env, db, config, and UI

## Monorepo Structure

```text
rdm-hack/
|-- apps/
|   |-- native/      # Expo React Native app, primary Hack Room UI
|   |-- server/      # Hono server exposing Better Auth and tRPC
|   `-- web/         # Web app shell
|-- packages/
|   |-- api/         # tRPC routers and Hack Room business logic
|   |-- auth/        # Better Auth setup
|   |-- config/      # Shared TypeScript config
|   |-- db/          # MongoDB/Mongoose connection
|   |-- env/         # App-specific environment validation
|   `-- ui/          # Shared web UI primitives
`-- hackroom_mobile_wireframe (1) copy.html
```

## Mongo Collections

The Hack Room API stores data in the `rdm-hack` database by default.

- `hack_rooms`: room metadata, invite code, host, participants
- `hack_tasks`: regular tasks, spot challenges, special tasks, legacy game task compatibility
- `hack_submissions`: proof records, status, host feedback, winner/XRDM state
- `hack_rewards`: participant certificates, winner certificates, NFT badge ledger records
- `hack_notifications`: host nudges to room participants
- `user`: Better Auth user records

## Prerequisites

- Bun `1.3.1`
- Node-compatible local tooling for Expo
- MongoDB local or hosted connection string
- Expo Go or an iOS/Android simulator for native testing

Install dependencies from the repo root:

```bash
bun install
```

## Environment Setup

Create the following env files. Do not commit real secrets.

### `apps/server/.env`

```bash
DATABASE_URL=mongodb://localhost:27017
DATABASE_NAME=rdm-hack
BETTER_AUTH_SECRET=replace-with-at-least-32-characters
BETTER_AUTH_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
```

### `apps/native/.env`

For a simulator or native web preview:

```bash
EXPO_PUBLIC_SERVER_URL=http://localhost:3000
```

For a physical phone using Expo Go, use your computer's LAN IP:

```bash
EXPO_PUBLIC_SERVER_URL=http://192.168.x.x:3000
```

### `apps/web/.env`

```bash
VITE_SERVER_URL=http://localhost:3000
```

## Running Locally

Start the API server:

```bash
bun run dev:server
```

Start the native app:

```bash
bun run dev:native
```

Or from the native app directory:

```bash
cd apps/native
npx expo start --clear
```

Start the web app:

```bash
bun run dev:web
```

Start all apps through Turborepo:

```bash
bun run dev
```

Default local URLs:

- Server health: `http://localhost:3000`
- tRPC endpoint: `http://localhost:3000/trpc`
- Better Auth endpoint: `http://localhost:3000/api/auth/*`
- Web app: `http://localhost:5173`
- Expo Metro: usually `http://localhost:8081`

## Native Hack Room Flow

### Signed Out

The native app shows a focused RDM login/sign-up page using `apps/native/assets/logo/rdm-logo.png`.

### Signed In

The native shell has:

- Header with RDM logo, notification, menu, and profile/sign-out entry
- Bottom navigation for Home, Hack Room, and Profile
- Safe-area-aware spacing so the app navbar does not collide with the phone navbar

### Host Flow

1. Create a Hack Room.
2. Share the invite code with participants.
3. Open room detail.
4. Use `Assignments` to create:
   - Regular task
   - Spot challenge
   - Special task for a registered participant email
   - Notification/nudge
5. Use `Created Tasks` to see created assignments.
6. Tap a created task to open `History` filtered to that assignment.
7. Use `Verify` to approve or return submitted proof.
8. Use `Award XRDM` to search teams and award from verified submissions.
9. Use `Awards` for certificates, NFT badge records, and reward ledger entries.
10. Use `Games` only to play mini-games.

### Participant Flow

1. Join with an invite code.
2. Open joined room detail.
3. Use `Submit Task` for regular/special task proof.
4. Required submission metadata:
   - Student name
   - Team name
   - Description
   - Required proof links/items
5. After proof is submitted, the submit card collapses while it is under verification.
6. If the host returns proof, the form reopens with feedback.
7. Use `Games` to play mini-games and view spot challenges.
8. Use `History` to track submitted, returned, verified, and winner states.
9. Use `Wallet` for XRDM, certificates, NFT badges, and ledger rows.

## Important API Procedures

The native app uses the `hackRoom` tRPC router:

- `dashboard`
- `createRoom`
- `joinRoom`
- `createTask`
- `submitProof`
- `approveSubmission`
- `returnSubmission`
- `selectWinner`
- `issueReward`
- `sendRoomNotification`

## Available Scripts

From the repo root:

```bash
bun run dev          # Start all apps through Turborepo
bun run dev:server   # Start Hono/tRPC API
bun run dev:native   # Start Expo native app
bun run dev:web      # Start web app
bun run build        # Build all configured packages/apps
bun run check-types  # Type-check the monorepo
```

App-level commands:

```bash
cd apps/native
npx expo start --clear
npx expo run:ios
npx expo run:android
```

## Verification Commands

Useful focused checks:

```bash
bunx tsc --noEmit -p apps/native/tsconfig.json
bunx tsc --noEmit -p packages/api/tsconfig.json
```

Native export smoke test:

```bash
cd apps/native
EXPO_NO_TELEMETRY=1 bunx expo export --platform web --output-dir /tmp/rdm-native-export
```

Full monorepo type-check:

```bash
bun run check-types
```

## Development Notes

- Keep native UI work in `apps/native` unless API/shared typing changes are required.
- Hack Room business logic lives in `packages/api/src/routers/hack-room.ts`.
- Environment validation lives in `packages/env`.
- Database connection lives in `packages/db`.
- Better Auth configuration lives in `packages/auth`.
- The native app reads `EXPO_PUBLIC_SERVER_URL`; restart Expo after changing it.
- If Metro shows a stale runtime error, restart with `npx expo start --clear`.

## Product Naming

- `Award XRDM`: choose winners and assign XRDM from verified submissions.
- `Awards`: issue certificates, NFT badge records, and reward ledger entries.
- `Games`: play-only mini-games for host and participant.
- `Spot Challenge`: proof-based challenge created from `Assignments`.
