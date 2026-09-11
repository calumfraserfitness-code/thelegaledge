# Legal Edge Client App — Product Rescue Audit

Audit date: 11 September 2026

## Active application surface

The production entry point is `index.html`, which loads `app-v2.js` and `app.css`.

Client primary navigation currently renders Planner, Training, Nutrition, Check-ins, Progress, Onboarding, Legal and Diagnostics. The intended primary navigation is Planner, Training, Nutrition, Check-ins, Progress and Diagnostics. Onboarding and Legal are account/reference areas rather than daily coaching navigation.

Coach navigation renders Dashboard and Clients. A selected client renders Overview, Planner, Training, Nutrition, Check-ins, Progress, Onboarding, Legal and Diagnostics.

## Competing source implementations

- `app-v2.js` is the active runtime.
- `app.js` is a complete older runtime containing its own state container, loaders, planners, training, nutrition, progress, diagnostics and demo clients. It is not loaded by `index.html` and is dead/conflicting code.
- The active runtime still contains unreachable `clientToday`, `clientCardio`, `clientMobility` and `clientSteps` screens after their navigation was removed.
- CSS contains rules for both runtimes, including multiple overlapping planner, meal, exercise, diagnostics and progress component systems.

## Canonical database model

| Concept | Canonical source | Historical/duplicate sources |
|---|---|---|
| Client targets | `clients` for goal weight, steps and legacy default macros; `nutrition_plans` for day-type macros | `program_weeks.goal_weight_kg`, `nutrition_days.*_target` |
| Programme prescriptions | `training_programs → training_program_days → program_exercises` | `exercises` is empty and belongs to the older session-copy model |
| Weekly workout assignment | `program_weeks → training_sessions`, linked by `training_sessions.programme_day_id` | `daily_plans` is empty |
| Exercise performance | `exercise_set_logs` | `exercise_logs` is empty; actual fields also exist on empty `exercises` |
| Reusable exercise | `exercise_bank` | Names also live on `program_exercises` by design as prescription snapshots |
| Nutrition day types/targets | `nutrition_plans` | `clients` macro columns are legacy defaults; `nutrition_days` is empty |
| Reusable meals | `meal_bank` | `meal_plan_meals`, `meal_plan_items` and `meals` are empty |
| Client meal assignment | `meal_assignments` | none active |
| Steps | `step_entries` | `progress_entries.steps` and `checkins.average_steps` are historical summaries, not daily truth |
| Weight/progress | `progress_entries` | `checkins.weight_kg` is the submitted source and should upsert into progress; `clients.start_weight_kg` is baseline |
| Check-ins | `checkins` | written history must remain in `original_answers`, not `coach_notes` |
| Photos/files | `client_files` + private Storage bucket | no active duplicate |
| Diagnostics | `diagnostic_reports` | `assessments` contains recovered source assessments but is not the rendered report model |

## Table inventory and live row counts

The public schema contains 34 tables. Material records: 13 clients, 113 check-ins, 76 progress entries, 13 onboarding records, 13 legal records, 11 diagnostic reports, 13 programmes, 63 programme days, 217 programme exercises, 63 weekly sessions, 167 exercise-bank entries, 3 set logs, 20 nutrition plans, 99 meal-bank entries and 94 assignments.

Empty legacy or future tables: appointments, audit_events, coach_notes, daily_plans, exercise_logs, exercises, habit_logs, habits, meal_plan_items, meal_plan_meals, meals, nutrition_days, step_entries and supplements.

## Root causes

1. Multiple full front-end implementations were retained instead of replacing the old runtime.
2. Historical migration populated canonical bank/prescription tables, while active UI loaders still query empty legacy tables (`exercises`, `meals`, `nutrition_days`).
3. Macro targets exist at client, nutrition-plan and weekly-nutrition levels without an enforced precedence rule.
4. Weight exists as baseline, weekly check-in and progress entry without a single selector for start/current/latest.
5. Recovered nutrition source text contains controls and headings from the old page, so naïve parsing produced fake ingredients such as “DAYS/WEEK” and incomplete quantities.
6. Exercise history was matched only by prescription ID, so a repeated movement in a new phase could lose previous performance.
7. Removed navigation screens remain live in JavaScript and CSS, increasing conflict risk.
8. The original rich diagnostics renderer survives only in the inactive `app.js`; the active runtime uses a reduced generic renderer.
9. UI actions often re-render the entire section after saves rather than updating a single component.
10. Demo clients and demo values exist in both runtimes, increasing the risk of mistaking preview behaviour for production data behaviour.

## Rescue decisions

- Keep `app-v2.js` as the sole runtime during the rescue and delete `app.js` only after all useful diagnostics/progress logic has been ported.
- Stop querying empty `exercises`, `meals` and `nutrition_days` once weekly canonical adapters are complete.
- Use `nutrition_plans` as the only macro source by day type; Planner references a plan rather than copying macros.
- Use `program_exercises` as prescription truth and `training_sessions.programme_day_id` as the weekly reference.
- Match previous performance by reusable exercise ID first, then normalized exercise identity where safe.
- Use `progress_entries` for charts, with check-in submission performing an idempotent daily upsert.
- Keep Onboarding and Legal outside primary client navigation.
- Restore the proven diagnostics renderer from git history before deleting the old runtime.

## Still broken at audit time

- No real wearable connection is implemented. Apple Health and Health Connect require native companion layers; Google/Fitbit requires an OAuth backend and encrypted token storage.
- No authenticated end-to-end test account exists for automated write/persistence tests in this workspace.
- Only three exercise set logs exist in the destination, so historical previous-performance coverage is incomplete.
- Many recovered meals lack exact quantities; the UI must not fabricate them. Coach editing and a data-cleaning workflow are required.
- Weekly session assignment/moving is not yet a complete coach workflow.
- RIR/RPE visibility is not yet controlled per client/programme.
