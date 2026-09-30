# The Legal Edge Client App — Persistent Project State

Last updated: 30 September 2026

## 30 September weekly meals and activity presentation

- Build `20260930-3` adds `plan-experience.js/css` and an accessible demonstration at https://legal-edge-client-app.vercel.app/?pilot=demo . The live demonstration was opened and exercised: seven named days, ingredient quantities, numbered preparation, grams/ounces switching, batch scaling, planner-to-cardio navigation, firm resources, and suppressed sponsor output below five responses. It is explicitly synthetic, local-only and creates no account, firm or pilot.
- Nutrition import now accepts 1–7 complete variants (frequencies total 7), or seven distinct weekday menus (Monday=0). Null targets are rejected. New security-invoker RPC `import_client_nutrition` validates and saves the whole menu atomically, deactivates earlier menus without deleting history and assigns uncompleted current/future dates in the current week. Completed/past assignments remain intact. The coach still publishes the week.
- Added `assign_client_week_nutrition` to the existing Monday draft scheduler. It fills gaps, preserves active manual assignments and completed records, and selects explicit weekdays before training/rest categories. Applied to six active current drafts: 42 saved-plan assignments. Repetition made zero changes. These are draft assignments, not seven unique generated menus or published plans.
- The client meal view has dated week selection, preparation steps, per-portion targets, optional batch quantities, a regional measurement switch and a measured weekly shopping list. Source menu/navigation scraps are not presented as cooking instructions. Planner includes links to each date's meals.
- Cardio and mobility screens now render linked programme exercises and day notes. Planner Open chooses the session's actual category. Exercise cards distinguish tempo/RPE/RIR and supersets; image_url support added to program_exercises/exercise_bank, coach editor and imports. Client prescription queries include bank video/image fallback.
- JS syntax and tests in `client-app-v3/tests/plan-experience.cjs` passed. Database tests under authenticated coach role passed for successful one/seven-day imports, explicit weekday alignment, preservation of old plans, atomic rollback on invalid ingredients, unassigned caller rejection and assignment idempotency. All synthetic database test writes were rolled back.
- Source audit (unique named meals / explicit cooking methods / meals with missing quantities or units): Emmet 6/0/6; Garrett 12/12/0; Joshua 6/6/4; Katerine 6/6/0; Kevin 6/0/0; Zach 4/4/0. Some original meals lack measurements or contain ingredient alternatives, so exact complete recipes are NOT finished for everyone. Emmet and Kevin have zero program_exercises and null programme source_json. Do not invent prescriptions or historical portions.
- Real coach/client browser sign-ins, production client persistence, wearable ingestion, employer accounts and firm invitation/enrolment delivery remain unfinished or unverified. No client identities were linked or external invitations sent. Existing leaked-password-protection advisor warning remains: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .
- Functional deployment commit `28fc1f28e7e1a1a0e5a42819bebeff707d94a5b5` was browser-verified; follow-up polish fixes date-labelled training-day descriptions, live completion counts and sample mobility/lower-body navigation.

## 30 September account error handling and deployment verification

- Live app: https://legal-edge-client-app.vercel.app/ ; browser verified deployed script `app-v2.js?v=20260930-1` and real sign-in page.
- Account creation and existing-roster linking share a provisioning helper. It gates expired sessions, surfaces backend JSON errors (including already-linked accounts), explains rejected authentication, and requires a returned client ID. Incomplete responses ask the coach to refresh the roster before retrying.
- JavaScript syntax check and isolated helper tests passed for missing session, backend conflict detail, rejected JWT, success, and incomplete response.
- Reconfirmed database: 13 saved clients, zero linked client identities, one auth user, zero firm pilots. Imported old-app passwords are not accounts in this new project's auth service.
- Private coach/client end-to-end flows remain unverified. The prior secure coach sign-in request was cancelled; do not restart it automatically. No accounts were provisioned, no firm invitations were sent, and no pilot was created.
- App commit: 36e39a5c2020af5976b8b9a598bf729e931db615. Cache-key commit: 886d9dd25c9d68df2b7e4102aa455fbf0c7fe397.

## 29 September client activation and firm resource update

- Build `2026.09.29.7` removes public sample preview controls. The real coach
  roster remains behind coach sign-in; the client account menu no longer has
  legal/onboarding navigation. New clients see consent then a more detailed
  training, nutrition and work-pattern questionnaire before coach review.
- Coach new-client setup now accepts starting weight and a 12+ character
  temporary password. `provision-client` Edge Function v3 can also link a new
  auth account to an existing imported client row using `client_id`, without
  duplicating the client or resetting saved onboarding/history. The coach must
  supply and verify each existing client's email and share the new temporary
  password privately; no existing password can be recovered from this project.
  No imported client was linked by this update. The new and linked login paths
  have not been exercised with an authenticated coach/client browser session.
- The coach pilot workspace now captures firm employee count and pilot capacity,
  and has a resource library. Coach can draft, tailor and publish a resource to
  one pilot; its members see only published resources under Firm resources.
  Four practical topic ideas are draft starters, not automatically published
  or sent. Migration `firm_resources` has RLS for assigned coach and members;
  `firm_size` adds optional employee_count. No real firm or pilot was created.
- The live sign-in page was reloaded and visibly showed only Sign in and Forgot
  password. Syntax and diff checks passed. Authenticated one-to-one and firm
  flows, invitation delivery and external employer access are still unverified
  or unimplemented; do not call this a completed firm rollout.

## 29 September weekly planner repair

- The existing 13 programme weeks were all dated 7 September, so the UI was
  treating a stale plan as current. Six active clients now each have one
  28 September draft copied from their latest saved schedule, for 40 scheduled
  sessions total. The original weeks and source records remain intact.
- Migration `automatic_weekly_drafts` installs `prepare_client_week(uuid)` and
  an active `legal-edge-weekly-drafts` pg_cron job for 00:05 UTC each Monday.
  The operation is idempotent, creates only the current week and copies
  training/nutrition day assignments as drafts. It does not publish a copied
  week or invent skipped historical weeks. A second manual call returned the
  existing week ID. The first future scheduled run has not yet occurred.
- Build `2026.09.29.6` selects the actual Monday week, limits planner rows to
  that week, offers a coach recovery button when a week is missing, and hides
  unpublished current drafts from the client planner. The live page displayed
  the new build marker at `https://legal-edge-client-app.vercel.app/`.
- Authenticated coach roster, publication, client sign-in and persistence
  remain unverified. Imported client records still lack auth/profile links;
  do not mistake the labelled preview for the 13 saved clients. The corporate
  pilot remains a foundation, not a completed employer integration.

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
