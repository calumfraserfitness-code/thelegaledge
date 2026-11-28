# Visual learning release - 9 October 2026

Rebuilt all 12 published Playbook resources as short visual lessons. Client-specific records are not used in the public handouts or demo.

Each lesson includes an editorial headline, a conceptual diagram, a scientific explanation with explicit limits, a three-situation interactive chooser, a realistic legal-work example, three practical next steps and linked original sources. Weight examples are explicitly synthetic and are not claimed to be client data. No universal targets, promised outcomes or invented media.

Twelve matching two-page PDFs are generated from the same content with embedded fonts, original diagrams and clickable evidence links. Their filenames include a content digest. Existing private uploaded media remains available separately. Lesson text, diagram labels, science, limits, situations, examples and steps are editable in the existing coach manager. Unchanged saves retain the generated PDF; content/title/evidence changes remove its link to avoid distributing an obsolete handout. Clients can print the current lesson; coaches can attach replacement PDFs through existing private storage.

The additive learning_design JSONB column uses existing resource ownership, publication RLS, revision history and optimistic-save guards. Only Calum's 12 seeded published resources were updated. The remaining prepared drafts retain their publication state. No health, onboarding or meal/training prescription was changed.

Verification: full deferred-script DOM tests, failure/save/ownership tests, real database rollback RLS fixtures, desktop and 390px local Chromium layout checks, synthetic trend and situation interactions, all 24 PDF pages rendered and visually inspected. Database security advisors reported no new issue from this change. Existing unrelated Auth/private-schema advisories remain.

Rebuild handouts with `python tools/build-playbook-handouts.py` after changing canonical content. Apply new content updates through a new migration; do not reapply the original migration. PDF generation uses ReportLab and DejaVu fonts.

## Recording preparation follow-up

Prepared three approximately 300-word spoken scripts for demanding weeks, late office meals and weight fluctuations. Coach manager recording notes and shot outlines now match the downloadable recording pack. Uploaded video placement moves directly below the lesson header, before diagrams and the written lesson. No recording or client playback is claimed until Calum records and attaches the actual files.
