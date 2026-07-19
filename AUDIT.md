# X Deck Lab 2.0.0 — Final Release Audit

- Release target: **2.0.0**
- State schema: **3**
- Catalog verification-through date: **2026-07-19**
- Final audit date: **2026-07-19**
- Deployment architecture: **static, root-only GitHub Pages PWA**

## Release decision

**PASS — approved for deployment.**

- Automated syntax and engine suite: **18 passed, 0 failed**.
- Chromium mobile regression at 390 × 844: **52 passed, 0 failed**.
- Normal-workflow console errors: **0**.
- Uncaught page errors: **0**.
- Root-only package validation: performed after documentation freeze and recorded in the release-validation artifact and checksum.

## Audit scope

The release was checked for:

- application boot and six-screen navigation;
- mobile-width containment and bottom-navigation usability;
- accessible names for visible controls;
- unique document IDs;
- 44-pixel minimum visible button targets in the final management workflow;
- inventory search, product entry, loose-part entry, quantity, condition, and notes;
- owned-parts recommendation generation and application;
- legal construction and inventory-capacity gates;
- deck rename, clone, and safe deletion;
- adaptive test-plan generation;
- battle recording, finish scoring, and contamination exclusion;
- analysis, matchup coverage, order analysis, and empirical forecast completion;
- opponent-meta profiles and custom tournament rules;
- readiness-policy persistence;
- state and catalog diagnostics;
- backup export, checksum verification, tamper rejection, valid restoration, and migration;
- duplicate product rejection inside one catalog patch;
- valid catalog-patch import;
- fresh-instance restoration of deck, inventory, and battle state;
- service-worker install, activate, cache cleanup, and production-shell coverage;
- root-only runtime references.

## Automated suite

Run:

```bash
npm run check
```

The 18 Node test cases verify:

1. official finish-point values;
2. valid three-Bey Takara Tomy construction;
3. duplicate physical-part rejection and the Regulation v12 ordinary-lock-chip exception;
4. expanded Custom Line and ratchet-integrated architectures;
5. announced-part blocking unless theorycrafting is enabled;
6. inventory capacity as an independent hard gate;
7. Wilson interval behavior and contaminated-battle exclusion;
8. readiness legality, evidence, coverage, confidence, and finish-route gates;
9. adaptive test-plan priorities and attack-mirror de-prioritization;
10. all six order permutations against position-specific meta evidence;
11. deterministic empirical forecasting for a fixed seed;
12. legal and supplyable owned-parts recommendations;
13. migration from v1 state into the schema-3 deck library;
14. seed-catalog integrity and released/announced status separation;
15. root-only runtime references and all six primary views;
16. service-worker cache manifest, lifecycle, and old-cache cleanup;
17. candidate-pool expansion when a larger inventory crowds the initial shortlist;
18. presence of backup-checksum and catalog-product-uniqueness import guards.

Result:

```text
18 tests
18 passed
0 failed
```

## Chromium mobile regression

The unchanged production HTML, CSS, and JavaScript were rendered in Chromium with:

- viewport: **390 × 844**;
- device scale factor: **3**;
- mobile mode: **enabled**;
- touch mode: **enabled**.

The release environment blocks browser navigation to loopback HTTP, HTTPS test origins, and `file://`. The harness therefore injects the unchanged production files into an isolated Chromium document context and provides a deterministic local-storage shim. This tests the actual application code and rendered interface. Service-worker behavior is independently executed by the Node lifecycle test.

The 52 browser checks include positive workflow coverage and negative integrity cases. Material results include:

- every primary view opened successfully;
- the previously reported More/management navigation stall was not reproduced;
- asynchronous forecasting completed before subsequent navigation;
- no initial or final horizontal overflow;
- mobile searches retained focus;
- inventory and loose-part state persisted;
- a ranked owned-only deck was generated, applied, and passed construction and capacity gates;
- deck clone and deletion preserved a valid active deck;
- one decided battle and one contaminated battle were stored, with only the decided battle counted as evidence;
- analysis, coverage, order, and forecast actions completed without uncaught errors;
- backup checksum matched on export;
- tampered backup data was rejected;
- a correctly recomputed backup checksum restored normalized state;
- duplicate product IDs in one patch were rejected;
- a valid patch imported successfully;
- a fresh application instance restored the deck library, inventory, and battle records;
- all visible final-workflow buttons met the 44-pixel target;
- visible controls across all primary views had accessible names;
- document IDs were unique.

Result:

```text
52 checks
52 passed
0 failed
```

See `browser-audit-result.json` for the complete machine-readable record and `mobile-v2-final.png` for the final mobile screenshot retained outside the deployment archive.

## Corrective actions closed in the final pass

### Backup integrity

Earlier behavior normalized imported state but did not compare the supplied checksum with the imported state. Import now recomputes the checksum and rejects a mismatch before changing local data.

### Catalog-patch product uniqueness

Earlier validation rejected IDs already present in the catalog but did not reject the same new product ID appearing twice within a single patch. Each incoming patch now maintains its own product-ID set and rejects duplicates before state mutation.

### Forecast/navigation synchronization

The regression harness initially moved away from Analysis before the asynchronous 6,000-run forecast had completed. It now waits for the forecast action to finish, then verifies the management view. This removed a harness race and confirmed that management navigation remains functional.

### Mobile installation assets

The final release adds 192-pixel and 512-pixel PNG manifest icons plus a 180-pixel Apple touch icon. These are cached with the rest of the root application shell.

## Risk controls

| Risk | Control |
|---|---|
| Forecast is mistaken for a physics simulator | Forecast is labeled empirical and prior-based; low-evidence status is explicit. |
| Raw win rate produces false certainty | Wilson 95% interval and configurable lower-bound gate. |
| One favorable matchup inflates readiness | Per-archetype and Bey × archetype coverage requirements. |
| One Bey carries the deck | Minimum evidence per Bey and optional multi-point-finish requirement. |
| Invalid trials pollute the evidence | Void/relaunch handling and contamination exclusion. |
| Illegal or unowned deck receives approval | Legality and inventory capacity are separate hard gates. |
| Recolors bypass duplicate rules | Functional part IDs, not color names, drive duplicate checks. |
| Announced product is treated as released | Announced records are blocked by default. |
| Large inventory hides a legal recommendation | Progressive candidate-pool expansion. |
| Static data becomes stale | Verification date, status separation, patch import, and diagnostics. |
| Upgrade/import corrupts data | Schema migration, backup checksum, normalization, and negative tamper test. |
| Local event rules differ | Custom scoring, duplicate policy, lock-chip policy, bans, and notes. |

## Domain boundaries

These are constraints of the subject matter, not unfinished software items:

- A static catalog requires maintenance after new announcements and releases.
- Event-specific rules may supersede presets.
- Part-role values are transparent heuristics rather than universal laboratory measurements.
- Forecast quality depends on representative, controlled, correctly classified battle data.
- Mold variation, wear, launcher condition, player execution, stadium condition, opponent skill, and field composition cannot be fully digitized by this platform.
- The application does not provide automatic battle sensing, computer vision, or physical simulation.

## Final approval

All identified software release blockers are closed. X Deck Lab 2.0.0 is approved as the finished root-only platform within the requested static GitHub Pages architecture and the stated empirical limits.
