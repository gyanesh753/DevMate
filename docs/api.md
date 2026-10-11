# API contracts

Base path: `/api`. JSON bodies only, maximum 64 KiB. Protected requests require `Authorization: Bearer <Supabase access token>`. User IDs are always derived from a verified token. Invalid/expired tokens yield 401; Auth outages yield 503. Anonymous browsing is supported; an invalid supplied token is never silently treated as anonymous.

All errors have this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Check the highlighted fields.",
    "fieldErrors": { "title": "Required" },
    "requestId": "uuid"
  }
}
```

`fieldErrors` is optional. Codes include `AUTH_REQUIRED`, `SESSION_EXPIRED`, `FORBIDDEN`, `NOT_FOUND`, `ALREADY_APPLIED`, `PROJECT_FULL`, `RECRUITMENT_CLOSED`, `DECISION_FINAL`, `STALE_VERSION`, `INVALID_TRANSITION`, `INVALID_CURSOR`, and `RATE_LIMITED`. HTTP statuses distinguish 400/401/403/404/409/413/429/500/503. Database implementation details are never returned. Private resources outside the caller's visibility can return 404.

## Discovery and profiles

- `GET /skills` returns the catalog as `[{id,name}]`.
- `GET /projects` accepts `search` (max 200), `type`, `experience_level`, `is_remote=true|false`, `owner_id`, `status`, `limit`, and `cursor`. Unknown/array parameters are rejected. Defaults: status `open`, limit 20, no other filter. Max limit 50. `type=all`, `experience_level=any`, `status=all` disable those filters. A specific experience filter also includes projects accepting `any` experience.
- Search is a literal, case-insensitive substring across title, description, and skill labels; `%`/`_` are escaped. Technical names such as `Node.js` remain searchable.
- Project lists include owner name, skill objects, member count and the viewer's own application summary. Queries perform indexed subqueries in one SQL request, not one request per card.
- `GET /projects/:id` also returns safe public member summaries and `remaining_places`. Inactive projects remain accessible.
- `GET /users/:id` and `PUT /users/:id` are own-profile only. PUT replaces editable fields: `name`, `bio`, `location`, `github_url`, `linkedin_url`, `skill_ids`. Email comes from the caller's Auth account, not profile responses.

List response:

```json
{ "items": [], "nextCursor": null, "hasMore": false }
```

Cursors include the exact PostgreSQL timestamp, ID, and a fingerprint of filters/viewer. Order is `(created_at DESC,id DESC)`. Treat cursors as opaque. Changing filters or identity requires restarting pagination. Cursors are validated, not authorization tokens. Concurrent insertions appear after refreshing the first page; pagination is not a frozen snapshot. No exact total is promised.

## Project writes

`POST /projects` accepts:

```json
{
  "title": "Build a useful tool",
  "description": "What we will build and why.",
  "type": "passion",
  "experience_level": "any",
  "industry": "",
  "is_remote": true,
  "location": "",
  "max_members": 3,
  "skill_ids": []
}
```

Returns 201 with project detail and the initial owner membership. `PATCH /projects/:id` takes the same complete editable form plus the last observed `version`. It is a form replacement, not an arbitrary partial update. Missing fields are validated using shared defaults. Only owners can edit open/in-progress projects; capacity changes require open status. A successful edit increments version, including skill-only edits.

`PATCH /projects/:id/status` accepts `{status,version}`. Transitions are `open → in-progress`, `open → closed`, `in-progress → completed`, `in-progress → closed`. Leaving open closes every pending application within the same transaction. Completion/closure are terminal. Stale versions return 409; clients must reload, not silently overwrite.

## Applications

- `POST /applications`: `{project_id,message}`, returns 201. Duplicate submissions return 409; fetch the saved state after an interrupted response before retrying.
- `GET /applications/me`: caller's applications; supports `status=all|pending|accepted|rejected|closed`, limit and cursor.
- `GET /projects/:id/applications`: owner-only review queue, with the same paging/status parameters and safe applicant summaries.
- `PATCH /applications/:id/decision`: `{status:"accepted"|"rejected"}`. Identical retries return 200, including after the project later closes. Reversing a decision returns 409. Accepted/rejected/closed are all terminal outcomes.
- The legacy `/applications/project/:id` path remains an owner-protected compatibility alias during rollout. Remove it after checking that no deployed client calls it.

Acceptance inserts one collaborator membership atomically. Filling capacity leaves other applications pending while the project remains open. Closing/starting recruitment marks unresolved applications `closed`, with `decision_reason=project_<status>`; it does not reject them. Explicit accept/reject records `owner_decision`.

## Bounds and request reliability

Title 120; description 10,000; application message 2,000; name 80; bio 2,000; location/industry 120; URLs 2,048 characters. Required text is trimmed and nonblank. Capacity is an integer from 2 to 20 inclusive; skills are distinct catalog IDs, maximum 20. In-person projects require a location. Profile URLs must use HTTP(S).

The client cancels superseded reads, preserves failed form input, and never automatically retries writes. API responses set `Cache-Control: no-store` and `X-Request-ID`. Limits per API instance are 600 requests/IP/15 minutes, and 60 mutations/user/15 minutes. Health checks are also bounded. Deploy a shared limiter store before adding API replicas.
