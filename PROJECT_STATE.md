# The Legal Edge Client App — Persistent Project State

Last updated: 21 September 2026

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
- Visible build marker in source: `2026.09.19.1`
- GitHub functional checkpoint: `d9e7915` (manual nutrition assignments protected)
- A follow-up local fix makes Auto-fill nutrition gap-only: it assigns Training Day
  to weights/resistance days and Rest Day to unassigned remaining days, while never
  overwriting a manually selected Busy Day or other individual-day assignment.

## Immediate next verification

1. Commit and deploy build `2026.09.19.1` to the existing production Vercel project.
   The 21 September execution environment has no authenticated Vercel CLI session;
   authenticate to the existing `calumfraser13cf-5687` workspace before deploying.
2. Verify the production page displays build `2026.09.19.1` and the Auto-fill
   nutrition button in Coach → Planner.
3. Verify the coach can save a historical check-in, progress entry, onboarding edit
   and legal record against Supabase.
4. Verify training and nutrition edits persist after reload.
5. Verify the client mobile experience and all published-plan completion controls.
6. Continue entering genuine recovered/client-supplied data; never invent missing data.

## Resume instruction for a future session

Read this file first, inspect `git status` and the latest commit, then continue from
the immediate next verification section. Do not restart the app or create another
Supabase/Vercel project.
