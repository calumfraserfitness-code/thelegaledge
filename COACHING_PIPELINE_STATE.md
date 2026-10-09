# Coaching recording workflow — 9 October 2026

Extended the production release branch after verifying its Vercel alias. Added the
Coaching Updates screen, private source history, pending proposals, editable coach
approval/rejection, an immutable review audit and Your Focus This Week with client
completion. Expired focus items archive daily. All existing plans remain intact.

Approval publishes checklist text only. Actual prescription changes must be made
in the existing nutrition/training editor; conflicting proposals require an explicit
reconciliation acknowledgement. Raw recordings, proposals and audits are coach-only.

Imported two user-designated source recordings into the private database using
tool-assisted transcript review, without retaining full transcripts or duplicating
the existing coaching guidance/private note. Four actions remain pending. The older
recording is marked historical and generates no current tasks.

SQL rollback tests passed for assigned coach review, target-conflict rejection,
idempotent approval, owner completion and other-client isolation. Real browser
coach/client sessions and automatic ingestion are separate verification gates.

Still incomplete: replacement Fathom credential, webhook registration/signing-secret
configuration, autonomous analysis worker/retries/alerts, authenticated scheduled
Loom polling, Google Calendar synchronization, pre-call brief delivery, full timeline
aggregation, retention/deletion controls and end-to-end provider event tests.

The existing Fathom webhook is deployed but is not a complete working integration.
Do not claim automatic processing is active. Browser credential rotation requires
user handoff. No credentials were copied into source, commits or frontend storage.
