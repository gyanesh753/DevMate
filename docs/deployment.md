# Deployment and recovery

This release changes the database and API contracts. Deploy the schema, API, and frontend together during a maintenance window. The repository does not contain hosting credentials or a verified production deployment target. Local verification does not imply the hosted database has been migrated.

## Prepare

1. Run all README checks against the local stack. Review the SQL migrations and security advisor output.
2. Record the currently deployed frontend/API revisions and environment configuration. Prepare the new frontend build and API release before entering maintenance.
3. Back up the hosted database (including Auth and public schemas) with the project's supported backup/export mechanism. Keep the backup outside Git with restricted access. Verify that it restores in an isolated environment. Record backup timestamp and recovery owner.
4. Prevent application writes for the duration of the schema/API cutover. Disable old API traffic and serve a frontend maintenance page. Do not apply the breaking migration while the old API is still serving writes.
5. Verify the baseline against the hosted catalog: the five original public tables, constraints, grants, `handle_new_user()` function and signup trigger. The baseline was captured before this implementation; do not assume an unchanged live database.

Preflight SQL (read-only):

```sql
select count(*) as profiles_without_auth
from public.users u where not exists(select 1 from auth.users a where a.id=u.id);
select project_id,applicant_id,count(*) from public.applications
 group by project_id,applicant_id having count(*)>1;
select id from public.projects where owner_id is null;
select a.id from public.applications a join public.projects p on p.id=a.project_id
 where a.applicant_id=p.owner_id;
select id from public.projects where max_members not between 2 and 20
 or max_members is null or btrim(title)='' or btrim(description)=''
 or length(title)>120 or length(description)>10000
 or (is_remote=false and coalesce(btrim(location),'')='');
select id from public.applications where project_id is null or applicant_id is null
 or message is null or length(btrim(message)) not between 1 and 2000;
select p.id from public.projects p where
 1+(select count(*) from public.applications a where a.project_id=p.id and a.status='accepted')>p.max_members;
```

Ownerless projects/dependencies and self-applications are the explicit archive cases in the migration. Resolve any additional invalid data deliberately before proceeding. The migration transaction rolls back if an unexpected constraint fails.

## Apply and switch

Discover installed CLI syntax using `npx supabase <command> --help`. Link to the intended project only after verifying the project ref. For the existing DevMate project, migration history was initially empty:

1. After confirming the baseline matches, use `supabase migration repair <baseline-version> --status applied` for **only** `20261010210939`. This records existing schema; it does not run baseline CREATE statements. Never mark the MVP migration applied without executing it.
2. Inspect `supabase db push --dry-run` and verify only the MVP migration is pending. Apply it once under the migration owner (`postgres`). Migration filenames must be created with `supabase migration new`, not manually timestamped.
3. Provision the `devmate_api` login with a generated secret through your credential manager. Use an administrative SQL session to enable LOGIN and set its password securely (for example, psql's `\password devmate_api`). Do not grant table ownership, `BYPASSRLS`, broad roles, or browser access. `service_role` is not the application login.
4. Load the skill catalog separately from `supabase/seed.sql` if needed. Its inserts are idempotent; existing normalized custom skill labels are preserved. Never run local development credential scripts against hosting.
5. Configure the API: restricted `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, explicit `ALLOWED_ORIGINS`, and the verified `TRUST_PROXY_HOPS`. Set `NODE_ENV=production`. Production TLS verifies certificates; configure `DATABASE_CA_FILE` for a private CA. Do not use URL SSL options that override verification. The API fails startup on privileged credentials or missing settings.
6. Deploy the API using the repository root install (`npm ci --omit=dev`) and `npm start -w server`. Deploy `client/dist` built at the repository root with production Vite variables. Configure SPA rewrites (`client/vercel.json` contains an example). Node 24 is the supported deployment runtime.
7. Configure Supabase Auth site/redirect URLs for the deployed `/auth` route, require email confirmation, and enable leaked-password protection if supported by the project plan. Use production SMTP appropriate to signup volume.
8. Smoke-test while maintenance remains enabled, then restore traffic. Keep the secured legacy application-list alias for the initial cutover; remove it once access logs show all clients use `/projects/:id/applications`.

## Verify and observe

- Run hosted security advisors and resolve application-schema findings.
- Confirm anonymous and signed-in direct Data API reads/writes of application tables are denied.
- Confirm signup creates a profile, login works, discovery is public, and an unrelated user cannot review applications or edit another project.
- Exercise apply → accept, duplicate submission, full capacity, final decision retry, close pending, and terminal project editing with designated test accounts.
- Confirm `/api/health`, HTTPS, expected CORS origins, database role startup checks, and SPA deep links.
- Monitor request IDs, 5xx/503 rates, latency, database pool saturation and 409 conflicts after cutover. Application logs intentionally omit raw tokens, messages and database details. Add a shared rate-limit store before horizontally scaling the API.

## Recovery

If the MVP migration fails, PostgreSQL rolls back that migration's changes. Inspect the failure, keep maintenance enabled, and correct unexpected data/schema drift; never disable constraints to force the release through.

If application smoke tests fail after a successful migration, keep maintenance enabled. Prefer a forward fix compatible with the new schema. Restoring the old application alone is unsafe because email/skill columns and response shapes changed. If a forward fix is not feasible, restore the verified pre-cutover backup and matching API/frontend releases together, then recheck Auth and write flows before restoring traffic. If traffic already resumed, account for new writes before restoring an older backup.

`private.migration_archive` preserves invalid sample rows for inspection; it is not a replacement for a full database backup. Do not drop the archive during the rollout.
