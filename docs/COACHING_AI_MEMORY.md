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

## Daily review

The enabled Legal Edge app review runs around 08:00 Europe/Dublin. It uses bounded read-only checks and reports actionable failures. It must not rewrite client plans, deploy, send client messages or alter production data. Persistent lessons support future maintenance; the model does not retrain itself automatically. Keep all lessons technical and aggregate; never commit private client health data or credentials.

## Outstanding real-world evidence

Phone sign-in after the October 11 auth hotfix, actual device notification display, wearable ingestion, backup restoration and AI-provider responses still need direct evidence. Some active clients lack approved published plans or a configured check-in day. Do not label all clients ready until these are resolved.
