# The Legal Edge Client App — Persistent Project State

Last updated: 30 September 2026

## 30 September weekly meals and activity presentation

- Build `20260930-4` adds `plan-experience.js/css` and an accessible demonstration at https://legal-edge-client-app.vercel.app/?pilot=demo . The live demonstration was opened and exercised: seven named days, ingredient quantities, numbered preparation, grams/ounces switching, batch scaling, planner-to-cardio navigation, firm resources, and suppressed sponsor output below five responses. It is explicitly synthetic, local-only and creates no account, firm or pilot.
- Nutrition import now accepts 1–7 complete variants (frequencies total 7), or seven distinct weekday menus (Monday=0). Null targets are rejected. New security-invoker RPC `import_client_nutrition` validates and saves the whole menu atomically, deactivates earlier menus without deleting history and assigns uncompleted current/future dates in the current week. Completed/past assignments remain intact. The coach still publishes the week.
- Added `assign_client_week_nutrition` to the existing Monday draft scheduler. It fills gaps, preserves active manual assignments and completed records, and selects explicit weekdays before training/rest categories. Applied to six active current drafts: 42 saved-plan assignments. Repetition made zero changes. These are draft assignments, not seven unique generated menus or published plans.
- The client meal view has dated week selection, preparation steps, per-portion targets, optional batch quantities, a regional measurement switch and a measured weekly shopping list. Source menu/navigation scraps are not presented as cooking instructions. Planner includes links to each date's meals.
- Cardio and mobility screens now render linked programme exercises and day notes. Planner Open chooses the session's actual category. Exercise cards distinguish tempo/RPE/RIR and supersets; image_url support added to program_exercises/exercise_bank, coach editor and imports. Client prescription queries include bank video/image fallback.
- JS syntax and tests in `client-app-v3/tests/plan-experience.cjs` passed. Database tests under authenticated coach role passed for successful one/seven-day imports, explicit weekday alignment, preservation of old plans, atomic rollback on invalid ingredients, unassigned caller rejection and assignment idempotency. All synthetic database test writes were rolled back.
- Source audit (unique named meals / explicit cooking methods / meals with missing quantities or units): Emmet 6/0/6; Garrett 12/12/0; Joshua 6/6/4; Katerine 6/6/0; Kevin 6/0/0; Zach 4/4/0. Some original meals lack measurements or contain ingredient alternatives, so exact complete recipes are NOT finished for everyone. Emmet and Kevin have zero program_exercises and null programme source_json. Do not invent prescriptions or historical portions.
- Real coach/client browser sign-ins, production client persistence, wearable ingestion, employer accounts and firm invitation/enrolment delivery remain unfinished or unverified. No client identities were linked or external invitations sent. Existing leaked-password-protection advisor warning remains: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .
- Functional deployment commit `28fc1f28e7e1a1a0e5a42819bebeff707d94a5b5` was browser-verified; follow-up polish fixes date-labelled training-day descriptions, live completion counts, failed-step-save rollback and sample mobility/lower-body navigation.

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


## 2026-09-30 training and firm recovery
User explicitly authorized new exercise prescriptions. Six NEW DRAFT programmes saved in Supabase, 143 prescription rows; source_system coach_requested_ai_draft. Original programmes untouched. Emmet cardio-only readiness assumption; Kevin proposed gym equipment; Joshua deadlift/swing alternatives; boxing classed cardio; paired home modules Mon/Wed/Fri; Zach backups optional and aligned Mon/Wed/Fri. Nothing published to clients. Roster account links still zero; no genuine participant login end-to-end test.
Corporate audit reproduced infinite RLS recursion in firm_pilots insert: firm_org_participant_read queried pilots, while pilot policy queried organizations, and had incorrect p.organization_id=p.id. Replaced with private auth-scoped security-definer membership predicate; coach rollback test now creates organization/pilot/5 members and rejects 6th and capacity > employee count. Capacity guards lock pilot and validate coach ownership; RLS remains enabled. UI now edits pilot dates/name/capacity/status and shows linked-login/consent/published-resource readiness. Add-member chooser excludes unlinked logins. Live self-enrolment/email invitation service still absent; use existing secure coach client provisioning and link account before membership.
Public ?pilot=demo now includes coach workspace and participant experience, all synthetic/local; no private roster exposed. Optional/backups excluded from programme scheduler. JavaScript checks and tests pass. Prescriptions remain draft for coach review, not recovered history. Missing client ingredient quantities/recipes not solved by this training update.

Follow-up: pilot workspace now has Create participant + login. provision-client accepts optional pilot_id, validates owned/open capacity before auth creation, optional starting weight for pilot participants, inserts linked membership under caller RLS, cleans new account/client/profile if membership fails. verify_jwt=true, coach role checked server-side. No emails sent and no real users provisioned. Mocked handler tests pass unauthorized/full/closed/missing-pilot prevention, optional weight success and membership failure cleanup. Live account login/onboarding untested because coach auth session unavailable. Public demo form mirrors this without saving accounts.


## 30 September populated corporate draft and CRM email reconciliation
User explicitly authorized CRM read access to recover coaching client emails, overriding the older no-CRM-read boundary for this narrow reconciliation. CRM was read-only. Copied 12 matched CRM client emails into existing null client email fields; six active have emails. Matching used exact names plus Zach/Zachary alias and Santos onboarding FULL NAME Katharine Santos, cross-checked with CRM client table. Maesum's CRM primary/alternate/LinkedIn/other email fields are blank. Existing statuses/history unchanged, profile links remain zero. Do not equate recovered email with usable login or send emails automatically.
New public pilot showcase at ?pilot=demo: ten fictional employees, eight active, one onboarding, one invited. Coach sample review/recap queue; participant normal/busy/minimum weekly actions; resources; synthetic sponsor baseline/midpoint report and suppressed endline; sample report review; internal editable delivery/revenue/cost/staffing calculator. All public sample names/results fictional and no real employee roster or CRM emails in static code. Normal/busy/minimum switching is illustrative only; actual workload-based plan switching is not implemented. Sponsor view is a report preview, not employer authentication. Multi-coach assignment is a future requirement.
Default hypothetical scale model: 34 firms x2 cohorts/year x$15,000 = $1.02m gross annual revenue, 680 participants/year, 5,780 annual delivery hours, six coach equivalents at22delivery hours/week x46weeks/year. Contribution reflects entered cost assumptions only, not forecast or guaranteed margin. Pricing anchored in saved expansion plan; no sales/contracts assumed.
Live coach pilot workspace adds actual enrolled/linked/consent/review-due counts, launch/monthly/midpoint/endline planning dates, actual current-week unreviewed check-in queue and direct private client/check-in buttons. Calls/reminders not scheduled or sent automatically.
Assessment window migration applied: baseline allowed prelaunch; midpoint opens start+35days; endline opens end-7days (fallback start+77). Client UI hides unopened forms, database trigger rejects early submissions; matching RLS/consent checks retained. Rollback SQL passed early rejection and on-time midpoint/endline acceptance; JS tests pass timings/economics and existing plan/pilot provision mocks. No real pilot or participant created. Actual first sign-in/end-to-end onboarding remains blocked by unavailable coach authenticated session; old passwords cannot be reconstructed.


## 30 September connected role preview
Public pilot draft now presents the same fictional firm/cohort through Calum/coach, participant and CEO/HR roles. Sample coach recap is held in memory per person and appears in that participant view; CEO/HR output excludes individual names and recap text, with tests. Participant has in-place weekly actions, sample exercise prescriptions and measured meal ingredients; no separate app/setup hop to inspect them. HR view covers voluntary recruitment sample copy and programme coordination; CEO view covers aggregated delivery, evidence and expansion decisions. This is preview role switching, not actual employer authentication or a production access-control implementation.
Scale presets compare hypothetical 34 firms x$30k/year,10 firms x$100k/year,5 firms x$200k/year. Larger assumptions change seats/cohort and programme pricing, carry staffing costs; no guaranteed contract value or buyer acceptance. Calculator inputs persist in memory between preview tabs. Tests check10-firm model revenue$1m,500participants/year and5coach equivalents. No private database/auth changes in this iteration; first-login/account linking gate remains.


## 30 September private participant plan editing
Firm roster adds direct Training/Nutrition/Planner entry points into existing one-to-one client editors, using the same client UUID foreign keys. Fixed check-in shortcut tab key and resets nutrition selection between clients. Public fictional roster now has Adjust plan: per-person session/exercise/sets/reps/rest/steps and breakfast portions/preparation; changes appear only for selected participant, local memory reset on reload.
Real meal edits now call security-invoker save_client_meal, coach-only and assigned-client checked. Atomically clones original Meal Bank recipe with the personal adjustment and relinks only selected meal assignment, preserving reusable source, historical assignments and other clients. Current shared cross-client recipes count was zero, but previous editor updated bank globally. Rollback test under authenticated coach created a shared test reference, saved personal copy, verified original/other client's assignment unchanged and new copy linked. No synthetic writes retained. Exercise editor only changes state after confirmed database save. No new client auth or employer accounts provisioned; authenticated browser persistence still unverified. Existing leaked-password-protection warning unchanged; no new advisor findings.


## 30 September complete coach participant preview and weekly check-in report
Public preview roster moved above review queue with Open coaching workspace buttons. Coach participant record has Plans, Check-ins, Progress, Goals. Participant gets weekly structured check-in, synthetic six-week progress history and measurable coach-editable goal. Sample check-in writes update same person's private coach record and weekly sponsor aggregate; excludes free text/goals/names; opt-out and fewer-than-five suppression tested. All demo state local in memory, not actual account edits; structured goal editing not yet production database-backed.
Real firm roster also exposes Check-ins and Progress alongside Training/Nutrition/Planner. New security-invoker coach-only firm_weekly_summary(uuid,date) computes energy/sleep/stress from saved weekly check-ins, one latest response per enrolled nonwithdrawn person, Dublin Monday window, enrolment/pilot/consent time checks. New include_weekly_ratings boolean on firm_consents defaults false; participant must explicitly opt in separately when accepting initial assessment consent. Existing consent never silently opts in. Each metric requires >=max(5,pilot threshold) valid 1–10 responses; reports include metric denominators and no text/weight/private goals. Report shown to assigned coach as review draft; real HR authentication and report delivery remain unbuilt. Rollback authenticated SQL tests passed latest-response deduplication, per-metric denominator, consent exclusion, suppression and unauthorized rejection; no fixtures retained. Security advisor unchanged existing leaked-password warning. No real clients provisioned or firm created; authenticated browser persistence still unverified.


## 1 October full shared coaching workspace
Audit still found 13 saved clients, zero linked profile logins, zero real firm pilots and zero health daily rows. Do not claim live participants or connected wearable data. No original/history records deleted or published in this change.
New production client_coaching_goals/calls/guidance tables linked to client UUID; RLS client read, assigned coach writes, unpublished guidance invisible to client, anonymous access revoked. Shared Goals and Support coach tabs create/edit measured goals (including decreasing targets), recorded monthly call times/links/status/recaps, private busy-week/eating-out/meal/recovery guidance with explicit measured ingredients. Client Coaching tab shows goals, calls, regional g/oz guidance and health access. Calls are recorded agreed times, not calendar invitations or automated booking.
Client planner lets participants choose date/time/timezone within the published week through security-invoker schedule_client_session, keeping linked prescription, preserving completed sessions and refusing dates outside week. Nutrition stays on its assigned dates; UI explains it. Progress shows personal goals and health summary. Missing readings no longer become zeros; health averages now use actual last seven calendar days.
New security-invoker submit_client_checkin atomically saves check-in and progress, validates Monday/current-past week and metric ranges, serializes per-client/week to prevent duplicate retry writes, and preserves unsubmitted progress measurements. Added period_start/workload/sleep_hours/busy_week/next_week_availability. Existing check-ins unchanged. Duplicate submission returns existing record, does not update; coach can adjust later. Photos remain separate uploads; partial failure explicitly says check-in saved/photo failed. Weekly sponsor summary excludes late-submitted responses for a different period. All report access still assigned-coach only; employer auth/delivery unfinished.
Rollback SQL tested with synthetic auth/profile/client fixture: client own-goal visibility, other-client isolation, hidden guidance drafts, client cannot change targets, persisted within-week timing and out-of-week rejection, atomic check-in/progress, preservation of waist data and idempotent retry. Fixtures fully rolled back. Invalid rating/adherence rejection also verified. Unit tests cover missing health samples, weight-loss direction, no-data goals, strength-only session counts and check-in metric fallback. Existing plan/pilot tests pass. Security advisor unchanged leaked-password-protection warning.
Public ?workspace=demo&person=0 now opens the SAME full coaching workspace with clearly labelled fictional data (coach planner, training, nutrition, check-ins, progress, goals, support, diagnostics/onboarding). Pilot roster Open coaching workspace now links here, replacing the shallow coach participant preview for this action. Sample data contains linked cardio/mobility/strength, seven dated menus/21 measured meals, guidance, goals and a sample recorded call. All demo changes local/reset on reload; source recipes examples not personal prescriptions/bodyweight-based automated recommendations. No fake health connection added. Real nutrition completeness and prescription review remain unfinished for some original clients. Real browser coach/client authentication, first login and wearable provider credential/sync tests still not verified.

Browser follow-up discovered existing clientCheckin called missing slider helper, blocking full client questionnaire. Added accessible shared 1–10 slider; workload/barrier/availability/sleep now included in written response readout. Planner has prominent Arrange my week shortcut and actual daily step-count entry, with saved manual counts contributing to goals when no recent wearable samples. Removed Target kcal placeholder for missing calorie targets. Full workspace browser verified goal creation and movement from Monday07:00 to Friday08:15 with same prescription; broader browser regression continued after helper fix.


Oct 1 final browser verification: latest full shared coaching sample loads; client check-in form now renders and submits locally; coach sees workload, sleep, barriers and next-week windows; exercise sets/reps/rest and 7 dated menus verified; US ingredient conversion and two-portion scaling verified. Missing meal macro totals now remain unavailable instead of misleading zero. SQL persistence/access/duplicate-check-in checks passed in rolled-back fixtures. No real authenticated participant browser or HR login verified; no client auth links or phone sync were created. Public workspace example remains explicitly fictional and resets on reload.


Oct 1 roster navigation separation: coach sidebar now 1-to-1 Clients and Corporate. loadCoach reads authorized firm participant client IDs; personal roster excludes corporate enrollment records, retains active and archived direct clients, and never mutates/deletes source records. Once corporate data is loaded, current membership list takes precedence so newly created/enrolled participants do not remain in direct roster. Corporate roster action opens full shared coaching workspace. Database count verified 13 direct saved clients and zero memberships; no real client transferred/enrolled. Tests cover direct/past inclusion, corporate exclusion and source preservation. Real roster visibility still requires coach sign-in.



## Oct 1 production brief execution checkpoint
Attached recovery brief ends mid section 26; known instructions used without replacing the app/repo/Supabase. Production audit found serious older check-in policies allowing any coach role to read/update other coaches' check-ins; self profile updates could edit role; ALL plan policies let clients mutate their prescribed training/nutrition. Migration secure_prescriptions_and_checkin_review fixes check-in assigned-client scope, removes self-service role/identity UPDATE grants (full_name/avatar remain editable under own-profile RLS), separates plan SELECT from coach INSERT/UPDATE/DELETE, and restricts shared training-template edits to created_by. Imported records untouched. Existing shared template read access retained.
save_checkin_review security-invoker RPC validates coach ownership, length, HTTPS links and response/video before completed review; atomically updates coach response, focus_next_week, reviewed_at. Indexed pending review query. Rollback SQL tests pass own/other coach isolation, persisted own review, blocked profile role promotion, blocked client plan writes, retained plan reads. Existing security advisor only warns leaked-password protection disabled.
Shared Today home now default client entry (coach View as client included). Reads client-local date, exact published week and dated meals; no first-active menu fallback; no invented step counts; shows assigned activities, measured-meal links, check-in status, weekly focus, next steps and agreed calls. Manual true step count form persists. Target tickboxes no longer write target as actual count. Client main nav six items; Progress/Diagnostics accessible in Account and Today actions. Goals/Coaching retained.
Coach Review queue reads assigned-client pending rows under RLS, 50 per page with exact pending count; historical answers retained; displays client-entered ratings and supplied constraints, no clinical conclusions. Explicit coach review form replaces response/video autosave fields. Historical cards preserve original data and show action points to clients. Queue available across direct/corporate clients.
Node tests cover timezone boundaries, exact date assignments, blank vs recorded zero, normalized wearable readings, unpublished-week suppression and factual labels; existing coaching/nutrition/pilot tests pass.
Not rollout-ready: 13 real saved client rows still zero profile links; no client credentials recreated; no new firm/pilot/member created; no live invitations/emails sent. Actual signed-in coach/client browser flow unverified. HR role/auth/report delivery, actual cohorts, automatic phone health bridge, coach-assigned heavy/travel variants and complete original-client recipes/media remain outstanding. No automated coaching changes or diagnosis added.


Training import now uses import_client_training security-invoker atomic RPC: bounded programme/day/exercise validation, coach-client ownership, HTTPS media, weekday/optional preservation, relational writes, source JSON provenance, duplicate-draft retry protection via advisory lock and existing matching draft. Original plans/history untouched. Rollback tests verify successful import, idempotent retry, Friday index/optional flag, rejected other-coach import, and malformed second day leaves no partial programme. All imports remain drafts until coach schedules/reviews them. Browser shared flow verified Today completion count, actual steps, exact dated meals, submitted check-in appearing in queue, saved completed coach review, action points visible on Today. Private storage bucket confirmed; weekly cron active but has no run history yet. No client logins created; signed-in client browser, firm HR, cohorts and phone health bridge remain unverified/unbuilt.


Oct 2 corporate continuity: all public pilot roster View participant/Adjust plan/Review actions and Participant tab now deep-link into the same full shared coaching workspace, with validated sample person/view/tab URL parameters. Client entry opens Today; coach entry opens the requested training/check-in/planner tab. Firm sponsor preview now describes practical employee support, HR coordination and agreed example evaluation criteria (proposed, not achieved results). Added coach-only per-pilot firm_programme_briefs table/UI for objective, measurable success criteria, working constraints, review date, continuation recommendation and evidence/next action. Separate table prevents participant SELECT on firm_pilots from exposing the working brief. RLS requires assigned coach, no anonymous grants, no employer access/delivery introduced. Rollback fixtures verify own coach create/update, other coach read/write blocked, client read/update blocked and original values retained. No live firm/client records created or changed. Shared samples remain fictional and reset on navigation/reload; demo firm review counts do not sync with workspace sample edits. Real HR login, cohorts, invitations, participant login migration and phone health bridge remain outstanding.


Oct 2 exercise media and branding: restored actual homepage tokens (#0b1929 navy, #b8962e gold, white) and Playfair Display/Lato/Montserrat; app and pilot use original public homepage logo. Pilot green palette replaced. New shared exercise-demos module resolves four exact RP technique movements (seated cable row, seated dumbbell shoulder press, normal-grip pulldown, incline dumbbell press) with official YouTube channel sources verified via search. In-app iframe requests start=0/end=45, shows explicit up-to-45-second segment label and movement cues, preserving set logging and original prescribed sets/reps/media in DB. Name aliases deliberately exclude standing press, neutral-grip pulldown and different rowing equipment. Sample shoulder press explicitly seated. Original full runtimes and playback cannot be certified: YouTube cloud browser returned unusual-traffic CAPTCHA; no bypass attempted. Other movements still lack sourced RP demonstrations and are explicitly marked Demo not yet added. Full exercise/media coverage NOT finished. No real client programme edits or unsafe substitution to suit library performed. Node regression verifies exact variants, requested segment bounds and workout log form retention. Logo references public homepage asset; not locally repackaged.


Browser follow-up: direct youtube.com watch page blocked, but the standard embedded RP players in the app successfully load and play. Verified source runtimes from player UI: seated cable row 18s, normal-grip pulldown 15s, seated dumbbell shoulder press 13s; incline dumbbell press DOM video duration 12s. Labels now show actual short runtimes. Shared coach RP technique library displays four demos and names remaining unmatched programme movements. Workout logging retained. Branding DOM verified Lato body, Playfair headings, original homepage logo, navy #0b1929/gold #b8962e and white background. No claim of complete coverage or verified original Mike/Jared identity for every clip; RP official channel identity verified. Full client-specific media sourcing remains unfinished.


Oct 2 expanded RP / unified app preview: 41 exact movement demos sourced from RP's official muscle training article video links. All 37 additions played in standard app embedded YouTube players; video DOM verified genuine original durations 9–17 seconds, four previous clips 12–18 seconds. Runtime labels updated; templates only create players when disclosure opens, removing on close. Search filters the technique library. No downloaded/rehosted clips or programme equipment substitutions; no certainty claimed every performer is Mike/Jared. Some programme movements remain unmatched (including sample goblet squat, incline pushup, split squat, mobility); existing saved media preserved.
Public full app preview now has 10 fictional firm clients and 2 separate fictional direct clients, each with full per-person cached coaching data. Corporate opens the same shared planner, training, nutrition, check-in and progress records. Role bar switches rosters, participant and CEO/HR summary within one app and keeps changes until reload. Seeded eight explicitly fictional current-week check-ins. Sample sponsor aggregate reads same cached current-week consented records, suppresses under five per metric, excludes individual answers. Real HR auth/delivery still unfinished. Production cache initialization no longer erases seeded sample records. No real client records/accounts modified. Tests verify metric keys, current-week filtering, consent suppression, private text exclusion, exact media variants and 41 distinct bounded short clips. Branding remains original homepage navy/white/gold and logo.


## 2026-10-02 clarity and demonstration changes
Published progressive disclosure: corporate roster first; single Open client action; pilot forms, resource library and operations collapsed. Coach client tabs group advanced pages under More. Client exercise sets/reps/rest and logging retained; intensity jargon removed from client cards only; technique cues collapsed. Readable navy preview selector replaces large role buttons and tracks view switches. Real saved client records/prescriptions untouched.
Video catalogue now 49 movements: 44 official RP embeds (new DB split squat 37s, DB walking lunge 10s, barbell hip thrust 11s played and measured in live app); five exact-variant Physitrack mobility links 11–24s, media durations checked. Physitrack opens official source pages, not rehosted videos. Generic stretch/rotation names refined only in fictional sample. Not every saved movement has a matched short demo; library reports remaining programme gaps. Goblet squat/incline push-up in sample still unmatched. Muscle & Strength source verification blocked by automatic review after access denial; no further attempts.
Health imports labelled as files rather than live device sync. New JWT-protected health-provider-status function reports only boolean Fitbit credential presence and native integration availability, never secret values. Signed-in clients check readiness before Fitbit connect; sample disables device linking. Fitbit connect/callback/sync functions exist but provider credentials and account authorization are not verified end to end. Apple Health/Health Connect automatic native integration remains unbuilt; file import exists. Zero health account connections observed; 13 saved client records and zero linked client profiles remain account-readiness blockers. No client data altered by this turn.
Validation: existing CJS tests plus client/coach clarity regression tests passed; live corporate, coach training and client session views checked. No automatic health-sync claim.


## October 2, 2026 — client experience refresh
Published simplified day-only planner; three meal categories preserving original saved variants; private client audio attachment/recording; three-step check-ins; reviewed adult nutrition estimate calculator; removed global 8,000-step roster label; company preview participation and consented group scores. Grocery guide rounds whole packs/counts and labels cooking/fruit yield estimates. Added explicit wide-stance goblet squat sample and 38-second official Physitrack demo. Real plans/clients not rewritten. Browser verified recipe portions, sample check-in scores/privacy, session completion and day move. All CJS checks pass including new nutrition estimate/portion checks. Signed-in storage/audio and client login flows remain unverified (no linked client profiles in prior audit). Full automatic Apple/Android/Google Health sync NOT implemented; MyFitnessPal partner access needed; old Fitbit API closes October30. Employer login, scheduled report delivery and complete movement coverage unfinished; incline push-up sample still lacks matched short demo. No provider connected falsely, no invitations sent.


## October 2 — authenticated employer and device integration checkpoint
Added employer provisioning and private aggregate report portal. Assigned coach creates firm-scoped employer login from verified email and temporary password, no emails sent. Employers query only their firm's pilots and consented aggregate reports (minimum five valid scores/counts); no individual client/health/answers/audio exposure. Current/eight prior weekly reports refresh every minute while open and can export aggregate JSON. Profile update grants exclude role to prevent client privilege escalation.
Own-client device keys: SHA256 hash stored, selected metric scopes only,30day expiry/revocation. health-device-ingest accepts daily snapshots and aggregated Health Auto Export JSON; validates dates/units/bounds, scopes, rate limit and repeated totals. Optional calories/macros/water included without mandatory tracking. Signed client pages poll summaries; metric-specific source precedence avoids double-counting. Apple exporter must be configured on the user's phone with Health permissions and paid/Premium automation. MyFitnessPal→AppleHealth→exporter supported by this format, direct partner OAuth unavailable. Google Health currently not onboarding new API projects; Android native adapter not built. Do NOT call all phone/watch providers connected.
22 real authenticated API checks passed using temporary isolated QA accounts: employer provisioning/report access, raw private data denied, profile escalation denied, audio persisted and playable by owner/assignedcoach only, ingest scopes/idempotency/rate/revocation, and under-five suppression after consent removal. QA cleanup fixed noncascading FKs; verified13originalclients,1originalauthuser,0QAprofiles/files/firms/devicekeys. User-created cooley firm preserved. QA endpoint retired to JWT-required410; committed harness contains placeholders and expiry0. Full public sample movement coverage now includes38second incline/tablepushup; catalogue52 verified clips. Existing coach-selected YouTube videos now inline first45second excerpts, explicitly not RP-verified. Real source gaps and ambiguous exercise prescriptions remain; complete real coverage not established.
AllCJS/normalizer checks pass. GitHub deployment and browser checks follow. iPhone/AppleWatch chosen for first device test; actual client login linking and device installation/permissions remain user-side requirements. No real client identity linked or external invitation sent. Existing leaked-password-protection warning remains; securityadvisor added no new findings.


## October 2, 2026 — employer access and device ingestion deployed
Commit 57c54d08fbb32d021dce4bf21f1be4b7b1f21f22 deployed to legal-edge-client-app.vercel.app. Migration 20261002193955_employer_reports_and_device_ingestion applied. New provision-employer and health-device-ingest functions active. Employer membership restricts assigned-firm reports, raw client/check-in/audio rows excluded. Reports use consented week-specific group ratings, minimum five per metric, and automatically refresh every minute while visible; in-app report download available. No email delivery or real employer account created. Own-profile role escalation blocked through restricted column update grants.
Signed-in clients can issue revocable 30-day scoped device upload keys. Raw token displayed once; DB stores hash; endpoint cannot read client records. Daily aggregated Apple Health / compatible JSON uploads replace daily snapshots without duplicate totals, enforce chosen metric scopes, and mark connected only after successful upload. Health Auto Export setup UI explains paid automation, Health permissions, locked-device delays. MyFitnessPal nutrition can arrive indirectly through authorised Apple Health sharing; direct partner OAuth remains unavailable. No Android native adapter built. Google Health currently not onboarding new projects; legacy Fitbit shuts down October 30, 2026.
22 authenticated live API checks passed using isolated fictional test identities: coach provisioning; employer aggregate access/private-data exclusion; unassigned-report denial; client role promotion denial; client audio persistence and owner/coach signed access; peer/employer audio denial; scoped device data writes; unconsented weight exclusion; rate limiting; duplicate daily upsert; foreign key creation/read denial; revoked key denial; small-group suppression. Audio fixture was generated silence, not a browser microphone recording. All temporary test identities, organisation, memberships, client records, storage objects and device keys removed in FK dependency order. Original 13 client records and the user-created Cooley firm preserved. Auth has one original coach user; 13 real clients still have no profile links. QA endpoint retired (JWT-required HTTP410); committed harness disabled with no active nonce/expiry.
Video catalogue now 52 measured short demos (44 RP, eight Physitrack), including incline push-up 38 seconds and standing calf stretch 11 seconds. Standard inline player fallback added for existing coach-assigned YouTube videos, clearly labelled first-45-second excerpts, not verified RP originals. All movements in the public sample have demonstrations; COMPLETE real-client movement coverage is still outstanding for exact equipment/stance variants and unsourced mobility names. Original real prescriptions and saved source URLs untouched.
Browser verification after deployment: sample client Strength A shows goblet squat, seated cable row and incline push-up demos; Connected health setup renders scope choices and disables credential creation for fictional preview. Corporate Employer portal access renders and disables real provisioning in preview. CEO/HR preview shows consented group scores and clearly labelled fictional data. No app JavaScript errors observed (only browser-extension metadata errors). Signed-in browser audio recording / real employer browser login and actual iPhone installation/permissions/exporter upload remain unverified. Public preview links do not prove device connection. Existing local regression suite and new device normalizer / live connection tests passed.


## October 2 — own coach phone/Garmin connection
Added coach My health connection page using the existing signed-in coach account and existing owner-scoped health ingestion. Personal health row is created only on explicit key creation, linked profile_id/coach_id to current authenticated user, source_system coach_health_test; hidden from direct/corporate client rosters and QA counts. No role change or new password/login. Existing profile uniqueness handles concurrent requests. Steps/sleep default; optional nutrition scopes. Raw key appears only once with private clipboard copy, 30-day expiry/revocation. Live owner-only status/daily readings poll every minute; no fictional values, connection only after upload. Official Garmin Connect→Apple Health instructions included, foreground watch sync requirement explained. Provider access still requires Garmin business programme approval and MyFitnessPal partner credentials; none are fabricated. Native iPhone installation/Health permissions cannot be granted from desktop workspace. All client-app CJS regression checks pass and coach-health syntax check passes. No own record/key or real data created by the agent; coach initiates setup in signed-in app. Signed-in browser and actual phone upload still pending.


## October 3 — reduce incomplete phone setup
Live audit still zero health connections, zero active upload keys, zero personal coach health profiles. Added documented Health Auto Export deep-link setup, using com.HealthExport://automation, prefilled own endpoint/custom header, JSON v2, daily aggregation including aggregated sleep, previous/current day and 15-minute cadence, no batching. Only verified exact Step Count/Sleep Analysis metric selections supported automatically; other scopes retain manual setup, never silently request all metrics. Private link generated only after key creation, remains in memory, no analytics/QR service/server storage. Button is intended for signed-in Safari on the iPhone and hands scoped key to the installed exporter; native Health permissions still required. Added safe ?setup=health entry to coach personal connection page after login. Regression confirms selected scopes/encoded header/aggregation and rejects invalid keys/unknown metric config; changed JS syntax passes. Actual phone and partner API access remain unverified/ungranted. No live private data or keys fabricated.


## October 3 — Hevy integration
Applied migration 20261003163352_private_hevy_workout_sync and deployed JWT-required hevy-sync v1. Hevy public API official Swagger verified /v1/workouts GET with api-key header, page/pageSize(max10); requires each account's Hevy Pro API key from hevy.com/settings?developer. Read-only provider integration: connect verifies key via real provider GET, sync reads up to latest 100 workouts, upserts by client_id/hevy_id, preserves actual exercises/sets/reps/weight kg/duration/distance/RPE/notes. Credentials encrypted AES-GCM using server-only HKDF key derived from service secret, owner client ID as authenticated data; service-secret rotation requires reconnect. Authenticated users have metadata-only column grants; encrypted credential fields inaccessible. Server validates signed-in user; only their own profile-linked client can connect; coach may create their own private coach_health_test record, excluded from roster. Other client ID parameters rejected. Disconnect nulls encrypted credentials, retains imported history. In-flight sync cannot restore disconnected/rotated credentials. Refresh every two minutes while visible, not an unattended background cron. Historical provider deletions not mirrored. No plan publishing/pushing/routine modification and no prescribed session automatically marked complete.
Client Connected health / coach My health connection includes private key form; key clears on submit and no chat/browser-tool collection. Safe ?setup=hevy entry after coach login. Hevy history visible to own client and assigned coach in Training; latest10 shown, US weight units converted at presentation only.
Tests passed: zero and missing metric preservation, original kg data, malformed dates, encryption roundtrip, denied wrong owner/secret. Transactional live RLS tests passed owner workouts/status, peer exclusion, assigned-coach history access, no assigned-coach credential/status access, no authenticated credential column access or import writes. Transaction rolled back completely; verified 13 real client records, zero QA identities and zero real Hevy connections. Advisor no new findings (existing leaked-password protection warning remains). Actual Hevy key/provider sign-in not supplied, so end-to-end real-account syncing remains unverified; do not claim connected. 


## 2026-10-05 — Sequential onboarding journey
Added private onboarding_journeys with read-only owner/assigned-coach RLS and guarded journey_action RPC. New coach Onboarding section enrolls an existing NEW linked account using coach-provided HTTPS welcome video and frozen versioned agreement. Existing completed/published clients cannot enroll; all original 13 clients preserved, zero live enrollments. Coach verifies receipt/reference to release welcome; no automatic payment provider integration or email deliveries claimed. Client proceeds welcome → typed-name/address/e-sign consent → existing health/privacy gate → intake → coach review → published coaching access. Intake split into three screens; agreement HTML copy downloadable by owner and assigned coach, including after access through account menu. Coach sees time in step and 48h follow-up indicators; client waiting screens poll every30s while visible. Fictional interactive preview ?onboarding=demo never submits to backend and welcome video is labelled placeholder, not supplied. Migration 20261005151643 applied. Transactional tests passed payment/owner guards, denied direct write, early intake block, owner welcome/sign/consent/intake, publish, unrelated isolation; rolled back all fixtures, zero test users. Security advisors no new findings (existing leaked password protection warning). JS syntax checked. Actual coach recording, approved agreement, payment provider webhook/receipt delivery need configuration; no emails sent or live clients enrolled.

Browser verification Oct5: deployed preview completed welcome → fictional signature → consent → paged training/nutrition/lifestyle → review → ready. Existing training preview loaded after journey. Added explicit FICTIONAL PREVIEW banners to consent/intake; no app errors observed, only browser-extension metadata errors. Real signed-in browser flow remains untested (no sign-in requested); database authenticated-role transition tests passed.


## Oct5 — Visual redesign and daily connection infrastructure
User rejected initial onboarding design and requested one-time per-client connection followed by daily sync. Rebuilt onboarding as navy side rail, cream page/white card, restrained gold, progress labels, large Playfair typography and consistent agreement/consent/paged intake. Actual welcome recording remains absent (preview labels video space). New connections-hub.js/css last-loaded replaces the lengthy health wall with 6 provider cards, focused setup/manage panels, last successful sync, stale health upload warning, retry status, optional scopes and one-time imports clearly separated. Applies to client Connected Health and coach My Health. Coach Connections overview lists personal/corporate clients and missing-login actions; each individual workspace also has Connections tab for read-only status. Keys never visible to coach.
Hevy v2 user endpoint imports immediately and schedules next at+24h. Added hevy-daily-sync v1: custom 256-bit vault-held worker token authenticated via service-only hash-check RPC, six-row skip-locked claims, cron every5min processes only due accounts, max100latest workouts, encrypted credentials bound to owner, generic retry flags, +24h success/+1h retry, conditional credential/status updates. Worker persists private workout history; no provider writes or auto-completion of prescribed sessions. pg_net + Vault server dispatch (no token printed). Migrations 20261005153336 scheduled_private_hevy_sync, 20261005154035 health_worker_service_schema_access, 20261005154333 health_worker_service_read_policy applied. First worker validation returned401 due missing service private-schema USAGE; fixed, verified authorized dispatch200 {checked:0,synced:0,failed:0}. Unauthorized dispatch401. Live cron active; no real Hevy connections yet, so real provider import awaiting first client key. SQL transactional tests passed coach metadata/no encrypted columns, unrelated denial, worker-only claims, invalid token, no duplicate claims, disconnect exclusion. Fixture rolled back, original13client count intact. Crypto/owner-binding and zero-preservation tests pass. No new security advisories; original auth warning remains.
Apple Health guided setup uses existing Health Auto Export Premium iPhone bridge + own scoped30day upload key; steps/sleep supports official deep-link. Optional weight/HR/nutrition requires manual matching exporter categories (MFP throughAppleHealth ifwritten); rawkeys behind Advanced andshownonce; no device permission or real upload supplied. Garmin viaAppleHealthphone bridge; direct enterprise credentials not supplied. Google Health officiallynotonboardingnewprojects andFitbitoldAPIturnsoffOct30; no broken OAuthbuttonshown. AndroidneedsnativeHealthConnectadapter. User's full one-click-all-provider outcome therefore remains partiallyblocked by provider/native prerequisites; do notclaimallintegrationslive. Original Fitbit endpoints preserved but new clientUIuses availability card.
Browser checked deployed onboarding welcome/agreement/consent and connectionhub cards; Hevy/Apple/MFPnutrition panels open, optionalscopes correct, no app JSerrors. Browserillustration only fictional client data, no accountsconnected. Latest smallfix scopesintakecaption within main card aftersidebarwrap, prefilllegalnamefrom signature. Coach/clientbrowserauthentication not requested; prior user refusal respected.
