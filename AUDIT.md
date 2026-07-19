# X Deck Lab 2.3.0 — Guided Player Release Audit

- Release target: **2.3.0**
- State schema: **6**
- Engineering model: **2**
- Catalog verification-through date: **2026-07-19**
- Audit date: **2026-07-19**
- Deployment architecture: **static, root-only GitHub Pages PWA**

## Release decision

**PASS — approved for deployment.**

- Syntax and automated engine suite: **34 passed, 0 failed**.
- Chromium mobile workflow: **70 passed, 0 failed**.
- Primary viewport: **390 × 844**, mobile and touch enabled.
- Additional small-phone overflow check: **320 pixels wide**.
- Normal-workflow console errors: **0**.
- Uncaught page errors: **0**.
- Visible button targets below 44 pixels: **0**.
- Initial and final horizontal overflow: **none**.

## Closed usability gap

Version 2.2 correctly instrumented self-KO evidence but required detailed cause classification and exposed technical controls in the ordinary battle workflow. That was unnecessarily complex for routine use and unsuitable as the default experience for children.

Version 2.3 replaces that workflow with one ordinary required question:

> Did your Bey go out by itself? — Yes or No

No self-KO subtype is requested or displayed. Detailed legacy causes are retained only for safe migration compatibility.

## Verified guided experience

### Four-step home path

The dashboard shows four interactive steps:

1. Add your parts.
2. Build three Beys.
3. Run guided tests.
4. Check readiness.

Each step shows current progress and opens the correct app section. A persistent **How to use** button opens a full guide with child-friendly definitions and an explicit note that the More screen is intended for advanced or adult-assisted use.

### Five-choice battle flow

The required battle workflow is limited to:

1. own Bey;
2. owned opponent;
3. result;
4. finish;
5. ordinary Self-KO Yes/No.

Technical opponent details and optional test metadata are hidden in expandable sections by default. The audit verified that the core workflow works without opening them.

### Self-KO validation

- Self-KO = Yes is stored as valid decided evidence.
- Self-KO = No is stored explicitly rather than inferred.
- Yes is rejected for wins, Spin Finishes, Burst Finishes, draws, and relaunches.
- Self-KO remains a real loss and is not automatically contaminated.
- The analysis view reports only simple test count, event count, and rate.
- Detailed cause labels, finish splits, and confidence terminology are absent from the player-facing self-KO panel.

### Legacy migration

Schema-5 and older records migrate to schema 6. Known historical own-self-KO causes map to `selfKo: true`; ordinary known non-self-KO records map to `false`; unclassified historical Over/Xtreme records remain unknown. The migration does not invent attribution.

## Testing and optimization controls

The release retains the engineering and evidence controls established in earlier versions:

- exact opponent combinations made from owned inventory;
- simultaneous two-Bey inventory-capacity checks;
- default exclusion of attack-bit versus attack-bit tests;
- legal, owned three-Bey suggestions;
- diversity-preserving candidate search;
- engineering proxies for impact, rotational inertia, spin retention, stability, control, KO resistance, recoil, self-KO risk, ratchet height, and matchup coverage;
- adaptive test planning;
- observed self-KO penalties in readiness and deck ranking;
- order optimization and empirical forecasting.

## Automated suite

Run:

```bash
npm run check
```

The 34 tests cover:

1. official finish scoring;
2. legal three-Bey construction;
3. duplicate-part and Regulation v12 lock-chip behavior;
4. expanded and integrated architectures;
5. announced-part gating;
6. inventory capacity;
7. Wilson intervals and unfair-test exclusion;
8. readiness coverage and finish routes;
9. exact owned-opponent planning;
10. attack-bit mirror exclusion;
11. engineering directional behavior;
12. bounded engineering metrics;
13. simultaneous two-Bey capacity;
14. reversible mirror policy;
15. legal engineering-ranked recommendations;
16. schema-3 migration;
17. position-order optimization;
18. deterministic forecast behavior;
19. owned-parts shortlist generation;
20. legacy v1 migration;
21. catalog integrity;
22. root-only references and current service-worker cache;
23. broad-inventory candidate expansion;
24. backup and catalog-import guards;
25. ordinary Yes/No self-KO evidence;
26. self-KO summaries by optional test metadata;
27. readiness penalty for repeated self-KO;
28. easy adaptive self-KO checks;
29. bounded modeled and empirical estimates;
30. deterministic forecast self-KO output;
31. legacy detailed-record normalization;
32. ordinary self-KO and kid-guide HTML surfaces;
33. opponent-self-KO legacy accounting;
34. optimizer demotion after repeated observed self-KO.

Result:

```text
34 tests
34 passed
0 failed
```

## Chromium mobile regression

The unchanged production HTML, CSS, and JavaScript were rendered in Chromium using a deterministic local-storage shim. Material checks include:

- application initialization and unique IDs;
- accessible names across all six views;
- four-step guide rendering;
- full guide and child-facing explanation;
- no horizontal overflow at 390 and 320 pixels;
- 44-pixel bottom navigation and visible button targets;
- inventory search focus and product/part entry;
- legal owned-deck generation and deck-library operations;
- exact owned-opponent selection and simultaneous capacity;
- attack-bit mirror exclusion;
- optional engineering details rendering;
- simple No and Yes self-KO records;
- rejection of an impossible Yes answer;
- unfair-test exclusion;
- simple self-KO analysis without detailed causes;
- order and forecast completion;
- guide visibility setting;
- backup checksum rejection and valid restoration;
- catalog-patch duplicate rejection;
- fresh-instance state restoration;
- zero normal console and uncaught page errors.

Result:

```text
70 checks
70 passed
0 failed
```

See `browser-audit-result.json`. The screenshots `mobile-v2.3-guided-home.png` and `mobile-v2.3-guided-final.png` are distributed separately and are not required for deployment.

## Engineering basis and limits

The model uses bounded qualitative proxies, not fabricated measurements. It does not know exact part mass distribution, launch angular velocity, friction coefficients, impact restitution, deformation, mold variation, wear, stadium condition, or player execution. Engineering output ranks hypotheses and selects useful tests. Controlled battle evidence remains authoritative.

## Risk controls

| Risk | Control |
|---|---|
| Self-KO recording is too complicated | One required Yes/No question; no subtype UI. |
| Children do not know where to begin | Four-step home path, full guide, progress markers, and section links. |
| Technical fields obstruct the main flow | Engineering and optional test details are collapsed by default. |
| A contradictory Self-KO is saved | Yes is accepted only for an Over/Xtreme loss. |
| A real self-KO is discarded | Self-KO remains decided evidence unless the trial itself was unfair. |
| Historical records are misclassified | Only unambiguous legacy data is normalized; unknown KOs remain unknown. |
| Opponent requires unowned or shared parts | Complete owned-build generation plus combined two-Bey capacity check. |
| Default tests waste time on attack mirrors | Attack-bit mirror generation and submission guards. |
| Physics score is mistaken for simulation | Explicit proxy wording and documented missing measurements. |
| Imported state is altered | Backup checksum verification before replacement. |
| Static rules or products become stale | Verification date, release-status separation, custom event profiles, and catalog patches. |

## Final approval

X Deck Lab 2.3.0 provides a simple child-usable player path while preserving advanced engineering, legality, evidence, and data-integrity controls. It is approved as the current root-only release, subject to ongoing rules and catalog maintenance.
