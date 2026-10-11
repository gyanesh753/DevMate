# Database design

Migrations are authoritative. `20261010210939_baseline.sql` represents the inspected legacy schema; `20261010210952_mvp.sql` upgrades it in a transaction. Historical `timestamp` values are interpreted as UTC during conversion to `timestamptz`.

| Table                           | Purpose and constraints                                                                                   |
| ------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `users`                         | Auth-linked profiles; no duplicate email. Auth UUID is the primary key.                                   |
| `projects`                      | Required owner; validated type/status/capacity; version and lifecycle timestamps.                         |
| `applications`                  | Required project/applicant/message; unique person/project; immutable identity/content and final outcomes. |
| `project_members`               | Unique project/person; exactly one owner; collaborator references the matching accepted application.      |
| `skills`                        | Case-insensitive unique catalog labels.                                                                   |
| `project_skills`, `user_skills` | Normalized associations, unique pairs and indexed skill lookups.                                          |
| `messages`, `reviews`           | Legacy future-feature tables; RLS enabled and no browser/API-role access.                                 |
| `private.migration_archive`     | Full JSON snapshots of invalid sample records and dependencies; no application access.                    |

`users` still contains legacy future-feature columns to avoid destructive cleanup of unrelated sample fields. They are not editable or returned by profile endpoints. Administrator account deletion requires a deliberate retention/dependency workflow; there is no end-user deletion endpoint in this MVP.

## Authorization

Only the dedicated `devmate_api` database login executes application SQL. It has no table ownership, DDL, role management, or RLS bypass. Browser roles receive no application-table grants. Default grants for future tables/functions are restricted for the migration owner (`postgres`); migrations must continue to run under that role or explicitly configure another owner's defaults.

`private.actor_id()` reads `request.jwt.claims.sub`, which the server sets from Supabase's verified user in each transaction. It does not depend on grants inside Supabase's managed Auth schema. Database credentials are a trusted server boundary: never expose them or permit arbitrary SQL/API callers to set this context.

Profiles, projects, skills, and accepted project membership have public-read policies for the API role. The HTTP layer returns explicit safe field lists. Applications are readable only by their applicant or project owner. Profile edits and owner actions use both grants and RLS. Membership and application identity columns cannot be updated by the runtime role.

Private functions have explicit search paths and revoked browser execution. `private.lock_project` is security-definer solely because applicants must lock a project without being able to update it; it requires a non-null actor and returns no data. The signup trigger is security-definer because Auth must create a profile. Other guards run with caller privileges.

## Consistency and concurrency

All write handlers acquire the project lock before application locks. The caller holds that lock through commit. The database validates state and capacity again in triggers. Acceptance adds membership; leaving open closes pending applications; project insertion creates owner membership. Deferred constraints verify owner/accepted membership consistency at commit. The runtime role cannot remove memberships or applications, so a unique application remains permanent.

A transient database conflict returns 409/503 rather than blindly replaying a mutation. The UI reloads current state before a user retries. Identical final decision requests return their existing outcome before checking current project status.

## Indexes and scale

Feed indexes cover `(status,created_at,id)` and `(owner_id,created_at,id)`. Application indexes cover project/applicant paging and project/status review. Foreign keys used by joins and cascades are indexed. GIN trigram indexes support literal substring search on title, description and catalog names. Small skill catalogs may reasonably use a sequential scan.

Lists fetch at most 51 rows, returning at most 50, to compute `hasMore`. Exact totals are not queried. Profiles/team counts are fetched through indexed SQL subqueries in a single request. Search uses no external search service. Pool size is bounded at 10; statement/lock/connection timeouts bound resource use. Review query plans and the provider connection budget before increasing replicas or pool limits.

## Migration checks

`npm run test:migrations` creates an isolated temporary database with the legacy schema and representative valid/invalid sample records. It checks Auth/profile preservation, skills migration, owner membership creation, and complete invalid-record archives. Tests never connect to hosted Supabase. The main local stack independently checks fresh migration replay, Auth integration, RLS, and concurrency.

The upgrade intentionally fails on unexpected duplicate applications, invalid required data, or over-capacity teams rather than inventing business decisions. Re-run the preflight queries in `docs/deployment.md` immediately before a hosted upgrade; the inspected sample data may have changed.
