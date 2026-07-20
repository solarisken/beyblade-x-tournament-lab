# X Deck Lab 3.2.0 Release Audit

## Scope

Mobile UI and UX refinement of the certified 3.1.0 platform without weakening catalog, rules, owned-opponent, deck-optimization, migration, backup, or offline behavior.

## UI and UX changes verified

- Bottom navigation reduced from six to five primary actions.
- More/settings moved to a 44-pixel header control.
- Player mode is labeled **Easy** and advanced mode **Pro**.
- Connection state is a compact accessible status indicator.
- Home’s four-step route remains visible but uses a compact four-column layout.
- Home shows only one recommended battle and three concise evidence summaries.
- The duplicate Coach roadmap card is hidden after setup is complete.
- Release search remains visible in a sticky control bar.
- Product filters and ordering are collapsed until requested and expose an active-filter count.
- Battle submission reveals a clear Coach-update handoff.
- Coach combines progress, strengths, and weaknesses into one snapshot panel.
- Battle patterns and simple engineering guidance use expandable sections.
- Technical analysis remains collapsed by default in Easy mode.

## Catalog policy retained

The library includes every mapped Takara Tomy Japan product containing at least one Beyblade performance part. Accessory-only products containing no performance part remain excluded.

Catalog status at verification date 2026-07-20:

- Qualifying products: 125
- Released products: 120
- Announced products: 5
- Mapped performance parts: 241

## Verification results

- Automated tests: 42/42 passed.
- Chromium mobile regression: 109/109 passed at 390 × 844.
- Small-phone overflow check passed at 320 px.
- Console errors during normal workflow: 0.
- Uncaught page errors: 0.
- Visible controls below the 44-pixel touch-target requirement: 0.
- Root-only runtime architecture retained.
- Service-worker cache version: v3.2.0.

## Critical behavior retained

- Legal three-Bey construction and duplicate-part policies.
- Released-versus-announced restrictions.
- Inventory capacity as a hard gate.
- Owned and simultaneously buildable test opponents.
- Default attack-bit mirror exclusion.
- Ordinary Self-KO Yes/No recording.
- Information-gain test planning.
- Complete-deck constrained optimization.
- Backup checksum verification and migration.
- Chronological release browsing and parts-only product support.

## Model boundary

The engineering layer uses dimensionless proxies for impact, spin retention, stability, control, recoil, and self-KO risk. It does not claim exact collision simulation because measured mass distribution, launch RPM, friction, wear, mold variation, launcher calibration, and stadium condition are unavailable. Real controlled testing remains authoritative.
