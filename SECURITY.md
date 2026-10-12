# Security Policy

## Reporting a concern

Do not open a public issue containing personal data, credentials or exploit details. Report a suspected vulnerability or privacy incident directly to the Legal Edge owner through the private business contact channel. A dedicated security email must be activated before a corporate pilot launches.

## Repository rules

- Never commit service-role keys, access tokens, passwords, client exports, signed documents, health records or production logs.
- Browser publishable keys are not secrets, but database row-level security must be tested before every release.
- Production secrets belong only in managed environment-variable or secret-vault services.
- Real client names and coaching details do not belong in source-control notes, fixtures or screenshots.
- Temporary participant passwords must be unique, at least 12 characters and changed through the authenticated recovery flow.
- The legacy static portal is retired. Browser-side passwords are not an access control.

## Release gate for a firm pilot

The app database blocks invitation or activation until the firm services agreement, data-role assessment, participant documents, DPIA, insurance, security review, subprocessor register, incident contacts and synthetic end-to-end test are verified.

## Incident handling

Preserve evidence, revoke exposed credentials, contain access, record when the incident was discovered and notify the business owner immediately. Regulatory and participant notifications are assessed under the documented incident-response process; do not promise that an incident is harmless before the assessment is complete.
