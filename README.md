# DevMate

Find teammates, post projects, apply to collaborate, and manage a team through completion.

React/Vite is the browser application; Express handles application data; Supabase provides PostgreSQL and Auth. The browser uses Supabase only for authentication. Direct Supabase access to application tables is denied.

## MVP behavior

- Search title, description, or skills; filter type, experience, and remote/in-person work. Search and filters live in the URL.
- Post projects, edit them with conflict detection, and manage recruitment and lifecycle.
- Apply once per project with a message. Owners cannot apply to their own projects.
- Review applications as the owner; track outcomes under My Applications.
- Capacity is **2–20 total people, including the owner**. Acceptance creates membership atomically.
- Accept/reject decisions are final. Starting or closing recruitment changes unresolved applications to **closed**, not rejected.
- Lifecycle: `open → in-progress → completed`, or `open/in-progress → closed`. Terminal projects remain readable. Reopening, deletion, ownership transfer, membership removal, and reapplication are not MVP actions.
- All project/application lists use cursor pagination. Filling a team does not change project status; owners can increase capacity while open.

Messaging, ratings, OAuth providers, and badges are future features. Existing messages/reviews tables are secured but have no application endpoints.

## Local setup

Requirements: Node 24 (`nvm use`), npm, Docker Desktop/Engine. Run commands from the repository root. One root lockfile covers both workspaces.

```sh
npm ci
npx supabase start --exclude realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
npm run setup:local
npm run dev:api
```

In another terminal:

```sh
npm run dev:web
```

Open `http://localhost:5173`. The API defaults to port 5000. If another service occupies it (including macOS AirPlay), set `PORT=5001` in `server/.env.local` and `VITE_API_URL=http://localhost:5001` in `client/.env.local`.

`setup:local` refuses remote database URLs, configures the local restricted database login, and generates ignored `.env.test` and `server/.env.local`. It creates `client/.env.local` only when absent. Rerunning it rotates the local database password: restart local API processes afterward. Credentials are not printed. Supabase local signup automatically confirms email; production must use email confirmation and configured redirect URLs.

The seed contains only a skill catalog. Create accounts and projects through the UI. `npm run db:reset` destroys **local development data** and reapplies migrations/seeds; it must never be redirected to production.

For manually configured environments, use [server/.env.example](server/.env.example) and [client/.env.example](client/.env.example). The API refuses privileged database roles. `SUPABASE_PUBLISHABLE_KEY` replaces the old `SUPABASE_ANON_KEY` variable; a legacy anon key still works as its value. Never put secret/service-role keys or database credentials in `VITE_*` variables.

## Verification

```sh
npm run lint
npm test
npm run build
npm run db:test
npm run test:migrations
npm run test:integration
npm run test:queries
npx playwright install chromium
npm run test:e2e
npx supabase db advisors --local --type security --level warn --fail-on error
npm audit --audit-level=high
```

- Unit/component tests cover validation, search URL behavior, stale requests, durable application UI, and failed form submission.
- Integration tests use real local Supabase Auth and the restricted PostgreSQL login. They cover authorization, final outcomes, races, paging, and connection identity isolation.
- pgTAP checks RLS/grants and schema invariants.
- The upgrade test creates a separate temporary database, applies the historical baseline and MVP migration, and verifies data preservation/archive behavior.
- Browser tests start their own servers on ports **5100/5174** and exercise signup and the owner/applicant journey.

Tests require generated `.env.test` and refuse non-local Auth/database URLs. CI runs the same checks on an isolated Supabase stack and retains browser traces only on failure. CodeQL remains enabled separately.

## Architecture and security

Application requests validate Supabase tokens server-side, obtain one database connection, begin a transaction, and set a transaction-local identity. Queries, locks, and commit/rollback use that same connection. Anonymous requests explicitly clear identity. Connections with rollback failures are discarded.

The `devmate_api` login has limited table/column grants, no DDL, no membership deletion, no ownership changes, and no RLS bypass. RLS restricts profile edits, project management, and application visibility. Public responses select only safe profile fields; email remains in Auth. Public project membership is intentionally visible, while pending/rejected application messages are private.

Database triggers serialize applications and owner actions through a project lock, enforce lifecycle/final decisions, insert memberships, and close pending applications. A private security-definer function exposes only the row lock to authenticated API requests, so applicants never gain project-edit permission. The signup trigger is also private. Neither function is executable through browser roles.

HTTP errors use safe messages and request IDs. Logs omit tokens, credentials, application messages, and raw database errors. Every response uses `Cache-Control: no-store`. CORS uses explicit origins; production TLS verifies certificates. Rate limits use an in-memory store: deploy one API instance for MVP; use a shared store before horizontal scaling. Configure `TRUST_PROXY_HOPS` from the actual hosting topology.

See [API contracts](docs/api.md), [database design](docs/database.md), and [deployment and recovery](docs/deployment.md).
