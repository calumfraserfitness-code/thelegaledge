# Legal Edge Health companion — pre-release

Native SwiftUI/HealthKit source. This is not a released or device-verified integration.

Uses existing client login, owner-only Supabase RLS and the deployed health-device-ingest receiver. Credentials are in device-only Keychain; only the hash of a scope-limited 30-day upload key is stored server-side. The companion renews keys with its authenticated client session. No service-role key, shared coach login, Health writes or employer access.

Select steps, sleep, optional resting heart rate and weight. Reads up to seven local calendar days, preserves missing values, uses HealthKit statistics for steps, excludes awake/in-bed sleep and merges overlapping stages from one source. Current-day data are partial. Phone-local dates are retained. Hourly HealthKit observer delivery and foreground catch-up are implemented; Apple controls delivery and locked-device reads can fail. Successful server receipt is required for confirmation.

Build with XcodeGen (`xcodegen generate`), open LegalEdgeHealth.xcodeproj in Xcode, select the actual Apple development team and a unique bundle identifier, enable HealthKit/background delivery for that identifier, sign and install. Distribute client pilots through the approved Apple route after test passes. No Apple identity, team, membership, signing certificate or phone is connected here.

Before inviting clients: compile/tests; sign/install on Calum's test phone; authorize selected metrics; compare each daily total with Health (Watch plus iPhone, midnight/DST, overlapping sleep and missing/revoked permissions); verify private coach display and other-client denial; test locked/unlocked catch-up, key rotation, disconnect, offline/retry and duplicate-day replacement. Publish only after these checks and required privacy/app-review disclosures. Disconnect does not delete saved coaching records. Health permissions can also be revoked in iPhone Settings.

CI builds the full app against the iOS SDK without signing, and runs the shared Foundation/XCTest date and sleep calculations with `swift test`. This does not validate Health permissions, background upload or device signing. The first simulator run exposed an incorrect test fixture date; the corrected case asserts both exact local dates around midnight.
