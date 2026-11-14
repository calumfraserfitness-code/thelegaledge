# Legal Edge reliability release checklist

Use the existing project and release/daily-nutrition-20261009; never substitute main. Preserve approved prescriptions, real client records, account mappings and message preferences.

## Every change

1. Reproduce the reported failure with the actual built runtime/SDK and synthetic APIs where possible. Add a regression covering failed saves, retry, retained newer input, account switching and both roles. A form opening is not a save.
2. Run npm ci --ignore-scripts --no-audit --no-fund, then npm test in client-app-v3. Record script count and failures. Do not use real client credentials or test writes for routine UI regression.
3. For new database reads, verify explicit owner/role predicates, revoked anonymous access, bounded scope/timeouts and minimal returned fields. Test own access and client/peer/anonymous denial; preserve existing RLS and private data. Inspect current advisors.
4. Stage the exact tested commit in the existing Vercel project. Require READY and successful exact-head regression, then inspect the canonical alias and commit. Do not announce a release only from Git or build success.
5. Run node scripts/release-evidence.cjs --verify https://legal-edge-client-app.vercel.app/ FULL_EXPECTED_SHA from client-app-v3. This verifies four public assets against generated build digests. It does not establish sign-in, working provider inference, client persistence or physical device behavior.
6. Inspect bounded owner-scoped failures and new status evidence. If a new regression appears, stop rollout and restore the last verified frontend deployment without deleting new database rows or reverting client records. Additive metadata functions can remain unused during frontend rollback.

## What still requires direct evidence

- One consented phone: sign-in, session reload, native weight/workout save, check-in submit and coach visibility, approved feedback and logout/account separation. Use the labelled QA account for test submissions; never publish synthetic feedback to a real client.
- Phone alerts: current-browser enabled registration, controlled provider acceptance, then confirmation that the alert physically appeared. No test alerts or emails are sent by App status.
- Watch sharing: first genuine owner-scoped receipt and a later background receipt, compared with source data. CI validation or a weekly report does not prove ongoing automatic ingestion.
- Food search: authorized end-to-end provider response, dated targets/restrictions, portion and region assumptions. Mock success and a saved key do not prove billing or live provider readiness. No dietary or calorie prescription changes without coach review.
- Recovery: replay/hash/relationship checks in an isolated or rolled-back destination; full-project auth/settings and uploaded file bytes remain separate from scoped snapshots.

## Current limitations

App status is read-only, checked only when opened/refreshed, and reports the current coach's notification jobs created in the last seven days. Health metadata covers assigned active/ending records, including not-yet-enabled setups. Bounds are 2,000 assigned records and 1,000 rows per metadata collection; reaching a cap is unavailable rather than a complete total. No capacity guarantee is implied. It is not continuous monitoring or a substitute for the dated daily review.
