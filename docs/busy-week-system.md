# Busy Week System

“When a lawyer’s week changes, Legal Edge changes the plan instead of allowing the plan to collapse.”

## Client experience

Open Today → Set up my week, or Schedule → Busy Week System. Enter expected working hours, typical sleep, realistic workout windows, minutes per workout, energy, recovery, any injury or illness, training location, meal access and travel. Defaults are editable estimates; they are never saved as client observations without submission.

The recommendation previews instantly. Save & adapt my week confirms the returned database values before showing success. The saved focus appears on Today, Schedule, Training and Nutrition. Changing answers recalculates the focus. Stale writes from another device are rejected rather than overwriting a more recent setup.

| Focus | Trigger | Result |
| --- | --- | --- |
| Normal | Regular workload, sleep and recovery; three or more training windows | Prioritise assigned workouts up to available windows |
| Heavy | At least 45 work hours, two windows, less than 6.5 hours sleep, energy/recovery 3 out of 5, or very limited meal access | Prioritise two workouts by default, bounded by available windows and coach settings |
| Crisis minimum | At least 60 work hours, fewer than two windows, less than five hours sleep, or energy/recovery 1–2 out of 5 | Prioritise one workout by default; zero windows means zero commitments |
| Coach review | A new injury or illness | Flag for coach review and pause affected training; no automatic new prescription |

Travel and home/hotel location are overlays. They do not automatically force a crisis week. Completed sessions count towards the focus; skipped sessions are not offered as priority workouts. Additional sessions stay accessible and retain their real completion status. Workload thresholds are product rules, not diagnostic cutoffs.

Priority workouts include assigned strength or cardio sessions. If the saved prescription exceeds available time, the client sees a request for a shorter coach prescription. Sets, intensity, rest and calorie/macro targets are not silently cut. The system adapts priorities and practical options; it does not manufacture a medically reviewed programme.

## Practical alternatives

- Home and hotel alternatives are selected by the coach from this client's assigned programme days and explicitly published.
- A client can switch an unstarted priority workout to the approved alternative, view the existing prescription and use normal workout logging.
- The original workout can be restored before any sets are logged. Completed or logged workouts cannot be switched.
- Missing alternatives are visibly flagged for assignment. Gym workouts are never relabelled as hotel workouts.
- Move a workout to a better day opens the existing saved timing tool. It keeps the move within the published week.
- Office/prepared meals connect to assigned meal ideas; takeaway options connect to published food and restaurant search.
- Late-night food and recovery guidance are shown alongside coach-specific notes. Food choices do not become eaten logs automatically.
- Paid restaurant/menu-photo generation retains its existing credit requirement. Busy Week System rules and assigned meal suggestions need no AI credits.

## Coach experience

Coach Home shows current saved client setups with review requests first. Open a client → Overview → Busy Week System to inspect their saved constraints. Coach options set heavy/crisis priority counts, instructions, home/hotel programme days, office/takeaway meal guidance, late-night guidance and recovery notes. Publish controls whether those specific alternatives drive the client view.

Each participant's setup is private to that client and their assigned coach. Corporate employer screens receive no individual workload, sleep, injury or illness answers from this feature. No calendar invitation is changed.

## Verification

- Pure model tests: mode boundaries, health precedence, travel overlay, completed-session credit, published settings and immutable histories.
- DOM tests: preview, confirmed saves, failed-save retention, duplicate submission protection and account isolation.
- Database transaction tests: real authenticated QA roles, save/reload, stale-write rejection, coach-only configuration, approved home switch, restoration, completed-workout denial, cross-client denial and anonymous denial. Fixtures roll back.
- Existing full regression suite gates production builds.

The initial release is a deterministic adaptation engine. It does not claim passive detection of calendar workload, sleep from every wearable, or self-training AI. Those require separately verified data sources and evaluation.
