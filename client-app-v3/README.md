# The Legal Edge Client App V3

Independent replacement for the existing coaching app. This is separate from the Legal Edge sales CRM.

## Backend
Supabase project: `The Legal Edge Client App` (`baxvhilvrhshlfizakak`) in `eu-west-1`.

## Current build
- Client authentication
- Role-based coach and client workspaces
- Coach dashboard, roster and full client workspace
- Separate training categories: Weights, Resistance, Cardio, Steps
- Reusable training programmes and programme days
- Monday-Sunday planner with publish/unpublish and week duplication
- Autosaving coach notes and check-in responses without page reloads
- Exercise completion tracking
- Nutrition macro targets and daily adherence
- Nutrition day types, meal plans, busy-day options, habits and supplements
- Meal completion tracking
- Expanded weekly check-ins and historical review
- Weight and measurement progress history
- Onboarding, legal consent, files/photos, messages, appointments and diagnostics schema
- Row Level Security so clients only access their own data
- Assigned-coach access rather than all-coach access
- Mobile responsive UI

## Architecture
Static client using Supabase Auth + Postgres directly with RLS. The signed-out screen contains synthetic coach and client previews so UI work can be reviewed before live accounts are invited.

## Important
Do not mix this project/database with `legal-edge-crm`. They are intentionally separate systems.
