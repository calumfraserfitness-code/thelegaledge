# The Legal Edge Client App — Persistent Project State

Last updated: 29 September 2026

## 29 September incident: client access is not migrated

- The Vercel deployment is an independent replacement, as `client-app-v3/README.md`
  states. It must not be presented as a live replacement for existing clients.
- Read-only database check: 13 imported clients (6 active), 113 check-ins,
  76 progress entries, 13 onboarding records, 13 training programmes and
  33 nutrition plans remain in `baxvhilvrhshlfizakak`.
- All 13 clients have source `legacy_clientmangmentsystem_v2`; **zero** have
  `profile_id`. The project has one auth user and one coach profile, with zero
  client auth/profile records. Thus none of the prior client logins can work
  against this replacement's Supabase Auth, regardless of the preview UI.
- The original `https://clientmangmentsystem-v2.vercel.app/` remains reachable
  and redirects to its own login. It was the source of the imported records,
  not the current deployment. Its identity store has not been inspected; do not
  infer original accounts were deleted. Original login is unnecessary to show
  already imported records to the new app's signed-in coach.
- All 13 imported rows are assigned to the new coach profile, but all 13 have
  null email and profile_id. The preview intentionally uses one synthetic client;
  build `2026.09.29.5` labels this plainly. Do not provision duplicate clients
  through `provision-client` (it creates a new client row) or invite existing
  clients until addresses/identities are reconciled. Coach authenticated roster
  and client session persistence are still unverified.
- The firm pilot foundation remains isolated in the replacement. Pause new
  corporate rollout until direct-client authentication and persistence pass.

## 29 September live and firm pilot checkpoint

- The existing Vercel project `legal-edge-client-app` is connected to GitHub
  `calumfraserfitness-code/thelegaledge`, branch `main`. Its Root Directory is
  `client-app-v3`. The initial Git build served the repository root and returned
  404; correcting Root Directory and redeploying fixed the production URL.
- The verified production URL is **https://legal-edge-client-app.vercel.app/**.
  Build `2026.09.29.4` loads on the production URL. Vercel marked commit `d5c3358` Ready in
  Production. Coach and client previews were opened; the coach Firm pilots area,
  roster preview, client Firm pilot account view and five-respondent suppression
  were visually verified. Preview records are local examples, not database data.
- GitHub commit `a9843bf` adds the additive firm pilot foundation; `50c27c6`
  refreshes the script cache key. Supabase migrations `firm_pilot_foundation`
  and `firm_report_invoker` were applied to the **client app project only**.
  They add coach-managed firms, pilots, rosters, client-authored consent and
  baseline/midpoint/endline assessments. The report function returns only
  aggregate phase averages when at least five consenting participants respond;
  there is no employer login or individual employer data path. The five new
  public tables all have RLS and no `anon` SELECT grant. No firms, pilots or
  participant records were created in the production database by this work.
- `node --check` passed on both JavaScript files, and `git diff --check` passed.
  The Supabase security advisor no longer reports a new function warning after
  switching the report to security invoker. Existing leaked-password-protection
  advice remains a separate auth configuration item.
- The nutrition import prompt now includes the actual onboarding answers and
  available calorie/macronutrient goals, and instructs the generator not to
  invent missing restrictions. A focused prompt-context test passed. GitHub
  commit `0377035` publishes build `2026.09.29.3`; its live marker was verified.
  The authenticated prompt-copy action remains untested.
- Authenticated coach/client UI → database → reload tests remain **unverified**;
  Secure coach sign-in was attempted but the site returned `Invalid login credentials`.
  The Supabase project has one confirmed coach account with email/password provider;
  GitHub credentials are separate. Password reset
  now has a recovery form that calls `auth.updateUser`, signs out, and returns to
  sign-in. The reset email/link and authenticated session are not yet tested.
- Authenticated coach/client UI → database → reload tests remain **unverified**;
  preview interactions and schema checks do not prove them. The old app remains
  reference-only and the separate CRM was untouched. Do not share sponsor reports
  until a real pilot has consent and at least five valid responses per phase.
- Continue the one-to-one regression gate with safe coach and test-client
  sessions; verify persisted training, nutrition, planner, check-in, progress,
  onboarding, legal and diagnostic flows. Next firm work: real invitation
  delivery, cohort scheduling, sponsor export review and Health Connect/Apple
  Health integration architecture. Do not promise those as shipped.

## 28 September recovery checkpoint

- Repository `main` was clean at `c3f2901` before this checkpoint. No local
  uncommitted work existed in the fresh checkout. Its source build marker was
  `2026.09.19.1`.
- The existing Supabase project is `ACTIVE_HEALTHY` on Postgres 17. Public
  tables reported RLS enabled and policies present. This is a schema inspection,
  not an authenticated cross-client access test. Applied migration history runs
  through `20260918161526_combine_historical_insert_policies`; four Edge
  Functions (`provision-client`, `fitbit-connect`, `fitbit-callback`, `fitbit-sync`)
  are active. No migration or database write was performed in this checkpoint.
- Read-only counts on 28 September: 13 clients (6 active, 1 ending, 1 inactive,
  5 past); 113 check-ins; 76 progress entries; 13 onboarding responses;
  13 legal consents; 13 training programmes, 63 programme days and 217
  prescription exercises; 3 exercise set logs; 33 nutrition plans,
  111 Meal Bank entries and 141 meal assignments; 11 diagnostic reports.
  All clients have a programme and onboarding record; two have no nutrition
  plan. These counts do not establish completeness against the old app.
- First reversible UI fix: respect a saved positive `daily_steps_goal` below
  8,000 throughout planner/completion displays and coach controls. 8,000 is a
  fallback for a missing/invalid target. Removed the coach's prefilled sign-in
  email. Source build marker and script cache key are now `2026.09.28.1`.
- Local checks: `node --check client-app-v3/app-v2.js` and `git diff --check`
  passed. No authenticated UI → database → reload test was possible here.
- The signed-in Vercel dashboard shows `legal-edge-client-app` ready in
  production, deployed 18 September 2026 via `vercel deploy`. The deployment's
  `index.html` shows build `2026.09.18.1`. Vercel says `Connect Git`; this
  project currently has no Git repository link. The Vercel connector separately
  returned 403 for scope `calumfraser13cf-5687`, and the production URL
  redirects unauthenticated requests to Vercel SSO. Production coach/client
  flows and mobile views remain unverified. Reauthorize the connector for this
  workspace or establish the approved deployment path, then obtain safe coach
  and test-client sessions for role-appropriate end-to-end checks.
- Priority next checkpoint: verify live source/build and authenticated writes,
  then produce a per-client source-completeness matrix for nutrition, training
  and check-ins before changing import or corporate features. Preserve old
  source records and do not fill gaps with generated historical data.

### Local follow-up: plan import parsing

- Build marker `2026.09.28.2` was published before the live checkpoint. Training and Nutrition import now
  accept a complete JSON object wrapped in a Markdown `json` code fence,
  reject unrelated prose and over-1-MB input with specific messages, and
  training validates day categories and exercise prescriptions before writes.
  The training import form keeps an error visible rather than relying only on
  a brief toast. Existing import writes remain non-atomic and have not passed
  an authenticated persistence test; do not describe this as a completed
  publish/versioning workflow.
- `node --check`, `git diff --check` and five focused parser/validator cases
  passed locally. No production deployment or database write occurred.

## Project identity

- GitHub: `calumfraserfitness-code/thelegaledge`
- Production app: `https://legal-edge-client-app-calumfraser13cf-5687.vercel.app`
- Vercel workspace: `calumfraser13cf-5687`
- Supabase project: **The Legal Edge Client App**
- Supabase project ref: `baxvhilvrhshlfizakak`
- Region: `eu-west-1`

## Hard boundary

This repository and database are only for the coaching/client app. Never read from,
write to, migrate into, or otherwise modify **The Legal Edge CRM**. The old coaching
app is read-only and must remain live until this replacement is proven seamless.

## Product goal

A premium coach and client application for legal professionals. The coach must be
able to add a client, review onboarding, build and publish training and nutrition,
manage a Monday-to-Sunday planner, review weekly check-ins, enter historical data,
view diagnostics and progress, and preserve all history. The client experience must
be mobile-first, clear, fast and limited to the plan that has been published.

## Current recovered data

- 13 client records
- 78 historical check-ins
- 76 progress/weight entries
- 13 onboarding records
- 13 legal/consent records
- 13 training programmes
- 63 training days
- 20 nutrition-plan records
- 111 Meal Bank entries
- 141 client/meal assignments
- 167 Exercise Bank entries
- 11 diagnostic reports

Exercise-level prescriptions and historical exercise logs from the old app were not
fully recovered. Do not fabricate missing sets, reps, rest times, loads, notes or video
URLs. The new data model and UI support entering these records now.

## Implemented coach workflows

- Add/provision a new client securely through the `provision-client` Edge Function.
- Configure region, units, goals, check-in day, steps, cardio and mobility.
- Edit and publish training programmes and days.
- Add exercises with sets, reps, load, rest, tempo, RPE/RIR, grouping, instructions
  and video URL.
- Reuse exercises from the Exercise/YouTube Bank.
- Import structured training JSON.
- Create and edit Training, Rest and Busy-day meal plans.
- Add ingredients with quantities, macros, preparation and cooking instructions.
- Reuse and assign meals from the Meal Bank and import nutrition JSON.
- Add historical weekly check-ins with original dated question/answer data.
- Add historical progress, measurements, steps and adherence.
- Edit onboarding JSON while retaining its question/answer structure.
- Add separate legal/consent records.
- Import structured blood-work and genetics reports.

## Implemented client workflows

- Published weekly planner with training, cardio, mobility, steps and nutrition.
- Set-by-set exercise logging and prior-performance history.
- Meal-plan display with ingredients, quantities, macros and instructions.
- Fast weekly check-in with sliders, written feedback and optional progress photos.
- Check-in submissions update the progress record.
- Progress charts, milestones and historical entries.
- Coach-reviewed diagnostics and video walkthrough links.
- Connected-health foundation and Fitbit OAuth/import infrastructure.

## Security rules

- Row Level Security remains enabled.
- A client may access only their own records.
- A coach may access only authorised/assigned clients.
- Never place a Supabase service-role credential in frontend code.
- Historical check-in and legal insertion policies permit the client owner or an
  authorised coach and still enforce `private.can_access_client(client_id)`.

## Current build

- Frontend entry: `client-app-v3/index.html`
- Main application: `client-app-v3/app-v2.js`
- Styles: `client-app-v3/app.css` and `client-app-v3/health.css`
- Visible build marker in source: `2026.09.29.3`
- GitHub functional checkpoint: `d9e7915` (manual nutrition assignments protected)
- A follow-up local fix makes Auto-fill nutrition gap-only: it assigns Training Day
  to weights/resistance days and Rest Day to unassigned remaining days, while never
  overwriting a manually selected Busy Day or other individual-day assignment.

## Immediate next verification

1. Verify the coach can save a historical check-in, progress entry, onboarding edit
   and legal record against Supabase.
2. Verify training and nutrition edits persist after reload.
3. Verify the client mobile experience and all published-plan completion controls.
4. Verify Firm pilots with a safe coach and test-client session, including
   participant-authored consent, one assessment and suppression under five.
5. Continue entering genuine recovered/client-supplied data; never invent missing data.

## Resume instruction for a future session

Read this file first, inspect `git status` and the latest commit, then continue from
the immediate next verification section. Do not restart the app or create another
Supabase/Vercel project.
