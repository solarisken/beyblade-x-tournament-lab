# X Deck Lab 2.1.0 — Engineering and Testing Release Audit

- Release target: **2.1.0**
- State schema: **4**
- Engineering model: **1**
- Catalog verification-through date: **2026-07-19**
- Audit date: **2026-07-19**
- Deployment architecture: **static, root-only GitHub Pages PWA**

## Release decision

**PASS — approved for deployment.**

- Syntax and automated engine suite: **24 passed, 0 failed**.
- Chromium mobile workflow at 390 × 844: **57 passed, 0 failed**.
- Normal-workflow console errors: **0**.
- Uncaught page errors: **0**.
- Final visible buttons below the 44-pixel target: **0**.
- Initial and final horizontal overflow: **none**.

## User-requested controls verified

### 1. Every generated opponent uses owned parts

The test planner no longer emits an archetype-only placeholder. Each task contains a complete opponent Bey and functional signature. The same exact combination is offered in the battle form and stored with the record.

### 2. The two test Beys can be assembled simultaneously

Owned status alone is insufficient. `inventoryCapacityForBattle` combines the selected test Bey and opponent requirements and compares them with recorded quantities. A shared one-copy part therefore cannot appear on both sides of the same test.

This control is enforced during:

- opponent candidate generation;
- adaptive-plan generation;
- opponent selection;
- final battle submission.

### 3. Attack-bit versus attack-bit testing is excluded by default

When the policy is active, attack-bit mirrors are filtered before plan creation and opponent rendering. Submission contains a second hard guard. Automated tests also verify that disabling the policy deliberately restores attack-bit opponent availability.

### 4. Decks are optimized using explicit engineering proxies

The model evaluates each complete Bey across ten bounded 0–100 metrics:

- impact potential;
- rotational inertia;
- spin retention;
- stability;
- KO resistance;
- burst resistance;
- X-Dash potential;
- control;
- recoil risk;
- self-KO risk.

Deck ranking combines meta-weighted matchup coverage, weakest-matchup strength, self-KO control, and mechanical diversity. Logged battle evidence is a secondary signal rather than a substitute for legality or supply.

### 5. Candidate search preserves mechanical diversity

The previous globally sorted candidate pool could overselect mechanically similar low-risk combinations. Version 2.1 uses bounded variant sampling and diversity-aware selection across top families, ratchets, bits, and bit roles. This prevents attack candidates and legal three-Bey assemblies from being crowded out while keeping mobile computation bounded.

## Automated suite

Run:

```bash
npm run check
```

The 24 tests cover:

1. official finish-point values;
2. legal three-Bey construction;
3. duplicate-part rejection and ordinary Regulation v12 lock-chip handling;
4. expanded Custom Line and integrated architectures;
5. announced-part gating;
6. deck inventory capacity;
7. Wilson intervals and contaminated-trial exclusion;
8. readiness evidence and finish-route gates;
9. exact owned-opponent adaptive planning;
10. hard attack-bit mirror exclusion;
11. expected engineering direction for attack and stamina mechanisms;
12. bounded engineering metrics and correct deck-position retention;
13. simultaneous two-Bey inventory capacity;
14. reversible attack-mirror policy;
15. legal engineering-ranked deck recommendations;
16. schema-3 deck-library preservation during schema-4 migration;
17. position-specific order optimization;
18. deterministic empirical forecasting;
19. baseline owned-parts recommendations;
20. legacy v1 migration;
21. catalog integrity and release-status separation;
22. root-only runtime references;
23. service-worker cache lifecycle;
24. backup checksum and catalog-patch uniqueness guards.

Result:

```text
24 tests
24 passed
0 failed
```

## Chromium mobile regression

The unchanged production HTML, CSS, and JavaScript were rendered in Chromium with:

- viewport: **390 × 844**;
- device scale factor: **3**;
- mobile mode: **enabled**;
- touch mode: **enabled**.

The execution environment blocks direct navigation to test URL schemes, so the harness injects the unchanged root production files into an isolated Chromium document and provides deterministic local storage. Service-worker behavior is executed separately in the Node suite.

Material results include:

- all six primary views navigated normally;
- inventory entry and loose-part quantities persisted;
- the engineering optimizer generated and applied a complete legal owned deck;
- an adaptive plan displayed exact owned opponents;
- the selected opponent passed simultaneous capacity verification;
- attack-bit mirror exclusion was verified;
- the opponent engineering preview rendered;
- exact opponent Bey data persisted in battle history;
- contaminated evidence was retained but excluded from decided analysis;
- engineering deck analysis, coverage, order analysis, and forecast rendered;
- engineering-search and readiness settings persisted;
- backup tamper detection and valid restoration passed;
- catalog duplicate rejection and valid patch import passed;
- a fresh application instance restored decks, inventory, and battles;
- no normal console or uncaught page errors occurred.

Result:

```text
57 checks
57 passed
0 failed
```

See `browser-audit-result.json`. The mobile screenshot is distributed separately as `mobile-v2.1-engineering-final.png` and is not required for deployment.

## Engineering basis and limits

The model uses dimensionless proxies, not fabricated physical measurements. The assumptions are consistent with standard rotating-body mechanics: radial mass distribution affects moment of inertia; angular momentum and contact forces influence stability and energy loss; tip contact, friction, precession, and nutation govern real top behavior.

The following measurements are unavailable and are therefore not simulated as facts:

- exact part mass and radial mass distribution;
- launch angular velocity and launcher calibration;
- coefficient of friction and material deformation;
- impact restitution and contact geometry at collision time;
- mold variation, wear, assembly condition, stadium condition, and player execution.

Accordingly, engineering scores rank testable hypotheses. They do not certify tournament performance. Controlled, representative battle evidence and conservative confidence gates remain the readiness authority.

## Risk controls

| Risk | Control |
|---|---|
| An unowned opponent enters the plan | Exact opponent generation requires positive recorded inventory. |
| One physical part is needed on both sides | Combined two-Bey capacity check rejects the pairing. |
| Attack mirror tests waste the default test budget | Hard filter and submission guard when the policy is active. |
| Similar candidates crowd out viable decks | Diversity-aware bounded candidate selection. |
| Physics score is mistaken for measured simulation | Explicit proxy labeling, confidence, assumptions, and model warning. |
| A high model score bypasses evidence | Readiness remains gated by empirical coverage and Wilson confidence. |
| Invalid launches inflate results | Contamination and relaunch exclusion. |
| Illegal or unsupplyable decks are recommended | Construction and inventory capacity are independent hard gates. |
| Upgrade loses existing decks | Schema-3 deck-library migration test. |
| Imported data is altered | Backup checksum verification before mutation. |
| Static rules become stale | Verification date, announced/released separation, custom profiles, and catalog patches. |

## Final approval

The requested testing and engineering changes are complete. X Deck Lab 2.1.0 is approved as the current root-only release, subject to catalog and rules maintenance after the stated verification date and the documented limits of qualitative physical modeling.
