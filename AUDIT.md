# X Deck Lab 3.0.0 Release Audit

## Scope

Coach-first workflow, player/advanced modes, information-gain testing, owned-opponent constraints, attack-bit mirror avoidance, constrained three-Bey optimization, explainable recommendations, battle-pattern coaching, ordinary Self-KO, mobile accessibility, migration, backups, and offline operation.

## Results

- Automated tests: 36/36 passed.
- Chromium mobile regression: 82/82 passed at 390 × 844.
- Small-phone overflow check passed at 320 px.
- Console errors during normal workflow: 0.
- Uncaught page errors: 0.
- Visible button targets below 44 px: 0.
- Root-only runtime architecture retained.

## Critical verified behavior

- Coach is introduced from Home and named consistently in bottom navigation.
- Player mode is default; Advanced mode deliberately opens technical details.
- The next mission exposes information value and uses a legal opponent made from simultaneously owned parts.
- Attack-bit mirror exclusion remains enforced by default.
- Ordinary Self-KO is one Yes/No answer.
- Optimized decks are legal, supplyable, and evaluated as complete three-Bey lineups.
- Readiness remains evidence-gated rather than battle-count-only.
- Backups use schema 7 and checksum validation.
- Service worker cache version is v3.0.0.

## Model limitation

The engineering layer uses dimensionless proxies for impact, spin retention, stability, control, recoil, and self-KO risk. It does not claim exact physical simulation. Missing measured inputs include part mass distribution, launch RPM, friction coefficients, wear, mold variation, launcher calibration, and stadium condition.
