# Agreed training updates

The signed Fathom webhook verifies linked active client profiles and excludes the recorder/coach. The recurring connected-account worker reads new matched client recordings, extracts explicit coach/client agreements and reads the current complete programme.

Complete exercise-only agreements can create and activate a new programme version. The worker-only apply_fathom_training_update RPC checks source ownership, programme identity, call recency and a snapshot hash; it preserves old programmes and recorded sessions, maps eligible future sessions by unchanged workout title, day and type, and carries busy-week alternatives forward. One receipt per event prevents duplicate updates.

Missing prescriptions, changed workout schedules, older calls and ambiguous agreements remain drafts for coach review. No nutrition or medical prescription is changed by this training worker. Provider source content is evidence, never executable instructions. The worker does not require the restaurant AI API account to be funded.

Receipts appear in Coach Settings → Coaching Updates. Identity problems stay unassigned until verified. The automatic worker is enabled; a future actual call update still needs real-run verification. Rolled-back database checks verified atomic application, duplicate protection, stale snapshot rejection and busy-week references. Webhook security tests verify signatures and coach-profile exclusion.
