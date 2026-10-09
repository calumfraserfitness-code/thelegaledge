# Prepared steps pilot — release gates

This is a preconfigured **steps-only** Apple Shortcut, not an installable/tested release yet. It reads Health samples from the last seven days and sends them to the existing private receiver. There are no embedded client keys, artificial readings, Health writes or payments.

1. Sign the template on a Mac with `shortcuts sign` (included `sign-on-mac.command`). The GitHub macOS workflow also attempts generic signing; its success must be inspected.
2. AirDrop the signed file to an iPhone and add it. Import asks for the owner's private setup key and one exact Health source name (Garmin commonly `Connect`, but the device must confirm it).
3. Run while unlocked and approve Health/network permissions. Read the **actual** server response. `saved_days` proves receipt; an error does not.
4. Compare at least the previous full day's total against **the selected source**, not Health's combined total. Test late-arriving records, a repeat upload, no samples, locked phone and revoked key.
5. Only after verification, create one personal Time of Day automation and an App Opened catch-up running this named shortcut. A shared shortcut cannot install personal automations or approve Health access for someone else.

The phone runs every prepared action; clients do not assemble filters or statistics. Server aggregation selects one source, deduplicates exact repeats, rejects overlapping samples and cross-day intervals, and ignores today's incomplete readings. Zero/missing data are not invented. Source-specific totals can differ from Apple's merged Health totals. Garmin must first write the relevant data into Apple Health. Android and direct Garmin/Fitbit account APIs are outside this Apple Shortcut.

Do not put a personal key into a publicly distributed template or commit it. Signing sends the generic file to Apple for validation. No Apple Developer Program membership is required just to use Shortcuts.

**Current verification:** plist/reference wiring and server normalization only. No physical iPhone upload or unattended automation verified. Keep client rollout gated until those pass. The source format uses observed iOS exports documented by https://github.com/viticci/shortcuts-playground-plugin; Apple CLI signing guidance: https://support.apple.com/guide/shortcuts-mac/apd455c82f02/mac.
