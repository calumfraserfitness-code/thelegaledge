# The Legal Edge Client App V3

Independent replacement for the existing coaching app. This is separate from the Legal Edge sales CRM.

## Backend
Supabase project: `The Legal Edge Client App` (`baxvhilvrhshlfizakak`) in `eu-west-1`.

## V1 features
- Client authentication
- Separate training categories: Weights, Resistance, Cardio, Steps
- Exercise completion tracking
- Nutrition macro targets and daily adherence
- Meal completion tracking
- Weekly check-ins
- Progress tracking
- Row Level Security so clients only access their own data
- Mobile responsive UI

## Architecture
Static client initially, using Supabase Auth + Postgres directly with RLS. This keeps the first deploy simple and free. The code can be migrated to Next.js later without changing the database model.

## Important
Do not mix this project/database with `legal-edge-crm`. They are intentionally separate systems.