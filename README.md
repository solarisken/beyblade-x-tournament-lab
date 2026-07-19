# X Deck Lab 2.1.0

X Deck Lab is a root-only, mobile-first GitHub Pages PWA for Beyblade X inventory management, legal three-Bey deck construction, physics-informed candidate ranking, controlled battle testing, opponent-meta planning, and empirical tournament-readiness analysis.

The application runs entirely in the browser. It has no build step, server, account requirement, or external runtime dependency.

## What changed in 2.1.0

### Owned-opponent testing

Generated test opponents are now complete Bey combinations assembled from the recorded inventory. Before an opponent is offered, the engine reserves both the selected test Bey and the opponent and verifies that their combined part quantities can exist simultaneously.

The test record stores the exact opponent combination and signature, not only a broad archetype label. Evidence can therefore be analyzed by:

- your Bey;
- opponent archetype;
- exact opponent combination;
- finish route;
- launch technique and position;
- contamination or launch-error status.

### Attack-bit mirror exclusion

When **Exclude attack-bit vs attack-bit from generated tests** is enabled, the restriction is hard-enforced in:

- adaptive test-plan generation;
- opponent selector population;
- battle submission validation.

The setting is enabled by default but may be disabled for deliberate mirror research.

### Physics-informed deck optimizer

Owned-part candidates are ranked through a transparent dimensionless engineering model. It considers qualitative proxies for:

- contact aggression and impact potential;
- radial mass distribution and rotational inertia;
- spin retention;
- stability and control;
- KO and burst resistance;
- X-Dash potential;
- recoil and self-KO risk;
- ratchet nominal height and inferred center-of-mass effect;
- mechanical and bit-role diversity;
- modeled coverage against attack, stamina, defense, balance, and left-spin opponents.

A diversity-preserving bounded search prevents one mechanically similar family from crowding the candidate pool. Final recommendations must still pass tournament construction rules and owned-inventory capacity checks.

This is not a rigid-body or finite-element simulator. The catalog does not contain measured mass distribution, launch RPM, coefficients of friction, deformation, wear, mold variation, or stadium-condition data. The model ranks hypotheses; controlled battle evidence determines readiness.

## Main workflow

1. **Inventory** — Add known products and loose parts, including quantities and condition.
2. **Deck** — Build manually or generate engineering-ranked legal decks from owned parts.
3. **Test** — Follow the adaptive plan and select an exact inventory-valid opponent.
4. **Record** — Log result, finish route, stadium, launch position, technique, contamination, and notes.
5. **Results** — Review Wilson confidence intervals, evidence coverage, engineering proxies, order analysis, and empirical forecasts.
6. **More** — Maintain meta profiles, custom tournament rules, readiness thresholds, catalog patches, and backups.

## Readiness policy

A deck cannot receive tournament-ready status solely from its engineering score. The readiness engine separately evaluates:

- construction legality;
- owned-part capacity;
- total decided-battle evidence;
- evidence per Bey and archetype;
- Bey × archetype coverage;
- lower 95% Wilson win-rate bound;
- contamination rate;
- multi-point finish evidence, when required.

Contaminated trials and relaunches remain in history but do not count as decided evidence.

## Deploy on GitHub Pages

1. Create or open a GitHub repository.
2. Upload every release file directly to the repository root.
3. Do not place the files in `src`, `public`, `dist`, or another wrapper folder.
4. In **Settings → Pages**, deploy from the branch root.
5. Open the published URL once online so the service worker can cache the application shell.

## Local verification

Node.js is required only for the release tests, not to run the app.

```bash
npm run check
```

Current certified result:

```text
24 tests
24 passed
0 failed
```

Run the Chromium mobile workflow audit with:

```bash
python browser-audit.py
```

Current certified result:

```text
57 checks
57 passed
0 failed
```

## Data maintenance

- Released parts are enabled by default.
- Announced parts remain blocked unless theorycrafting is enabled.
- Catalog patches can add parts and products without rebuilding the application.
- Imported backups are checksum-verified before state replacement.
- Schema migration preserves existing v2 deck libraries while upgrading to schema 4.

The bundled catalog was verified through **2026-07-19**. Recheck official rules and product status before events held after that date.

## Root files

Production runtime:

- `index.html`
- `styles.css`
- `data.js`
- `core.js`
- `app.js`
- `manifest.webmanifest`
- `service-worker.js`
- `icon.svg`
- `icon-192.png`
- `icon-512.png`
- `apple-touch-icon.png`

Verification and documentation:

- `README.md`
- `AUDIT.md`
- `browser-audit.py`
- `browser-audit-result.json`
- `test.mjs`
- `package.json`
- `LICENSE`

External audit artifact (not required for deployment and distributed separately):

- `mobile-v2.1-engineering-final.png`

## Privacy, license, and trademarks

Inventory, decks, settings, meta profiles, and battle records remain in browser local storage. Export a backup before clearing browser data or changing devices.

Application code is provided under the MIT License. Beyblade and Beyblade X are trademarks of their respective owners. X Deck Lab is independent and unofficial and contains no copyrighted product imagery.
