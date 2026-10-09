# Legal Edge Playbook — 9 October 2026

Integrated into the existing static app, Supabase project and client navigation. Existing client records and prescriptions are preserved. Main client entry: **Playbook**. Coach entry: **Playbook Manager**. The previous learning route redirects; the duplicate onboarding content editor is retired while intake evidence/funding remain.

## Delivered

- Six problem-led entry choices, indexed server search with pages of 30, bookmarks, maximum two contextual/coach recommendations, dismissals, optional deeper reading and maximum three related guides.
- 24 substantive resources, 12 published and 12 prepared editorial drafts. Each has a quick answer, detail, action, safety, evidence links, related content, recording script and seven-slide outline. No claim that Calum reviewed or recorded them. The coach can revise before wider rollout.
- Coach creation/editing, review/publish/unpublish/archive, optimistic concurrent-save checks, previous revisions, private video/PDF/thumbnail/VTT uploads, transcripts, client preview, recommendations, feedback and real 30-day engagement counts. No autoplay or fictitious video blocks. Small uploads capped at 50 MB; larger production video libraries will need a dedicated media service or plan review.
- Assigned workout options explicitly approved by the coach for each session/time/location/energy. No unbounded AI prescriptions. Preview, accept and restore; original kept, accepted history visible to assigned coach. Server validates movement identity, limits sets to original and rejects stale options. Current programme edits invalidate client overlays. Home/hotel options require coach approval with appropriate equipment; no invented bodyweight session appears.
- Meal help uses published, assigned meals with recorded intake restrictions, real ingredients and existing dated food choices. No invented restaurant menus or nutrition values. Choosing a meal adds an uneaten choice and does not change targets. Travel support links existing training/planner and useful guidance.
- Three editable optional firm collections, publish/assignment/removal controls, same client Playbook, separate opt-in reporting consent. Fixed current-month aggregate RPC authorizes cohort coach or employer; requires at least five consenting participants, suppresses small measures and rounds participation into bands. Individual identities, search text, written feedback, medical information and training/food records never leave that report.
- Ready message requires completed intake, published plan status and a real published week containing assigned sessions.

## Accessible asset inventory

| Asset | Classification | Treatment |
|---|---|---|
| Existing SVG Legal Edge logo and approved welcome WebP | Ready to reuse | Existing brand assets retained; no unnecessary stock images |
| Three `starterPreview` onboarding articles | Needs revision / duplicate | Their useful orientation stays in onboarding; no second school/library navigation |
| `coaching_start_resources` rows before build | Missing | Table had zero rows; extended additively and populated |
| Existing school modules / educational PDFs / slides / videos | Missing in accessible repository | No matching media files found; not invented or represented as available |
| Exercise demo links | Ready to reuse in training | Existing exercise options and demos retained; not mislabelled coach education videos |
| New video scripts and slide outlines | Prepared | Editable recording aids, not completed videos/presentations |

## Phone sharing

`shortcuts/Legal-Edge-Steps.unsigned.shortcut` is a preconfigured read-only **steps pilot**, with 18 actions and two import questions (own private key and exact Health source name). It handles extraction and submission without asking clients to assemble statistics. Receiver v3 computes completed-day snapshots from one source, deduplicates exact repeats, rejects overlapping/cross-day samples, ignores today's partial data and keeps existing daily/export formats.

Signing is a separate Apple gate. Included Mac signing helper and GitHub macOS signing workflow attempt a generic signed template with no private keys. This release does **not** claim an installable, verified phone connection. Do not give it to clients until a physical iPhone test confirms import, unit/source/date wiring, Health permissions, matching totals, server receipt, revoked keys, repeated imports and locked-phone behaviour. Personal automations and permissions cannot be installed remotely. Android/direct Garmin/Fitbit integration remains unavailable; Garmin data must first reach Apple Health.

## Verification and limits

- Full existing script-chain DOM checks cover navigation, published content, feedback failure/success, illness/no-option protection, approved acceptance/restoration, preserved prescriptions, account-switch isolation, manager/media fields and unchanged onboarding gate.
- Transactional database fixtures check client/coach/employer/anonymous permissions, draft isolation, direct-history-write denial, set limits, scoped acceptance/restoration, original preservation and privacy-preserving corporate aggregation. Fixtures roll back.
- Receiver normalization checks cover source isolation, duplicate handling, completed days, repeated snapshots, overlaps, cross-day samples, invalid/oversized/unauthorized inputs and compatibility.
- Production deployment and canonical asset hashes must be checked after publishing. Browser visual QA and a real device upload have not been completed here. No claim of a 1,000-user load test or verified backup restoration. Current backend is Free; capacity/storage/backup provisioning requires a separate measured production review before scaling.
- Current security advisor's leaked-password protection warning predates this feature; no new Playbook security warning. Other work's private tables remain untouched.

## First 30 days

Week 1: invite a small group, review navigation and helpfulness feedback, fix confusing actions.
Week 2: review actual searches and popular answers; record the first concise coach videos, with captions.
Week 3: approve additional workout options based on real schedule/equipment needs; review meal-choice friction and recommendations.
Week 4: review usefulness, prepare the next ten resources from real unanswered questions, and open corporate collections to a consenting pilot. Add content for demonstrated demand, not volume.
