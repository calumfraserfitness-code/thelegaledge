# Legal Edge operating memory

Use client-app-v3/RELEASE_20261009.md as the authoritative release checklist. Production source is release/daily-nutrition-20261009, root client-app-v3. Do not substitute the older main branch.

## Evidence and safeguards

- Preserve existing client records and approved prescriptions. Missing plans require coach input; never fabricate approved training or nutrition.
- Unknown health values remain unknown; zero is a recorded value. Imported check-in timestamps are not proof of original submission time.
- Calculate check-in weeks and deadlines in each client’s named timezone, including daylight saving. An unset due day must not mark the client overdue.
- Auth requests need finite timeouts, retry controls and one shared account boot. The pinned same-origin Supabase SDK avoids external CDN dependence and browser lock stalls. Mock-provider tests do not verify a real iPhone login.
- Server drafts must recover after rejected network promises and prevent double submissions. Keep draft health answers off browser local storage.
- A previous comparison must come from an earlier recorded check-in for the same client. Failed reads must not show false completion or invented deltas.
- Run npm ci and npm test in client-app-v3. Vercel’s versioned build command runs the regression suite before publishing. Passing tests cannot guarantee every device or future feature.
- Provider acceptance is not proof a phone displayed a push notification. A wearable connection needs genuine provider data; no seeded results.
- AI food estimates must retain provenance, region and portion assumptions. Provider keys belong in the encrypted coach vault, never browser code or this public repository.

- Capture attachment files and ownership at submission start. Recheck account/client between uploads; never attach a later photo using a newly selected client or clear another screen’s voice note.

## Daily review

The enabled Legal Edge app review runs around 08:00 Europe/Dublin. It uses bounded read-only checks and reports actionable failures. It must not rewrite client plans, deploy, send client messages or alter production data. Persistent lessons support future maintenance; the model does not retrain itself automatically. Keep all lessons technical and aggregate; never commit private client health data or credentials.

## Outstanding real-world evidence

Phone sign-in after the October 11 auth hotfix, actual device notification display, wearable ingestion, backup restoration and AI-provider responses still need direct evidence. Some active clients lack approved published plans or a configured check-in day. Do not label all clients ready until these are resolved.

October 16 recovery evidence narrows the backup gap: the current scoped snapshot passed an exact PostgreSQL temporary-table replay, hash check and all 130 relationships between included collections (78 tables, 3,637 rows), with every temporary change rolled back. Full-project/offsite recovery, excluded auth/credentials and uploaded file bytes remain unverified.

Phone-alert setup must confirm both the browser subscription and its enabled current-account database registration. Bound service-worker waits and make failures retryable; capture the account before asynchronous setup and recheck before server writes. Backup downloads likewise require an unchanged account and a confirmed scoped bundle. Monitor both submit_client_checkin and save_checkin_review RPCs; PATCH-checkins alone misses reviews.

## October 12 transition evidence

A full-app login wrapper disabled the submit button before the base handler’s duplicate-submit check, suppressing the provider call. Test login through every loaded module; isolated auth tests are insufficient. Runtime bundling must preserve separate global script boundaries and DOM-ready registration.

Old source check-ins use source client ID plus source week as their identity. Calendar weeks may contain multiple source submissions; preserve original week labels and leave ambiguous periods unset rather than merging or fabricating dates. Exact imported timestamps remain unverified. Source snapshots are on-demand, assigned-coach-only records. A snapshot of a loading screen is incomplete, not migrated data. Never declare all clients ready while source transfer, account mapping or approved plans remain incomplete.

Coach food search uses explicit selected-client ownership plus caller RLS; never impersonate a client to test it. Coach search is read-only for client logs/preferences. Compare against server-calculated dated targets and eaten logs, preserve unknown values, and reject stale account/date responses. Restaurant results are estimates; a successful provider status probe does not prove the full search response works.
