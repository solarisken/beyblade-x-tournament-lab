# X Deck Lab 2.0.0

X Deck Lab is a mobile-first, offline-capable Beyblade X tournament-preparation platform designed for direct deployment from the root of a GitHub Pages repository. It combines physical inventory control, legal deck construction, owned-parts optimization, controlled battle logging, adaptive test planning, opponent-meta modeling, deck-order analysis, and uncertainty-aware tournament-readiness assessment.

It is an empirical decision-support tool. It does not claim to reproduce Beyblade physics or guarantee tournament outcomes.

## Deploy on GitHub Pages

There are no source, public, assets, or build folders. All deployment files remain in the repository root.

1. Extract the release ZIP.
2. Upload every extracted file directly to the root of a GitHub repository.
3. Open **Settings → Pages**.
4. Select **Deploy from a branch**.
5. Select the deployment branch and **/ (root)**.
6. Save and wait for GitHub Pages to publish `index.html`.

The application has no server-side dependency. After the first successful online load, its service worker caches the production shell for offline use.

## Platform functions

### Inventory and catalog

- Quantity-based inventory of individual physical parts.
- One-tap addition of cataloged products and stock combinations.
- Category-dependent loose-part picker.
- Condition and notes for each inventory entry.
- Separate released, announced, and locally patched records.
- Announced-part theorycrafting is opt-in and disabled for ordinary legality checks.
- Catalog patches reject duplicate part IDs, duplicate product IDs, and missing part references.
- Seed catalog: 217 parts and 46 products, verified through 2026-07-19.

### Deck laboratory

- Versioned multi-deck library with create, select, rename, clone, and delete operations.
- Basic/Unique construction.
- Ratchet-integrated blade construction.
- Custom Line using Lock Chip + Main Blade + Assist Blade.
- Expanded Custom Line using Lock Chip + Metal Blade + Over Blade + Assist Blade.
- Standard Ratchet + Bit and ratchet-integrated bit architectures.
- Full assist-blade names in selectors.
- Functional-part duplicate validation independent of recolor.
- Physical inventory-capacity validation as a separate hard gate.
- Takara Tomy Regulation v12 preset, conservative WBO presets, and custom event profiles.

### Owned-parts intelligence

- Ranked legal and inventory-supplyable three-Bey recommendations.
- Structural role spread and finish-route heuristics.
- Existing battle evidence incorporated when available.
- Progressive candidate-pool expansion so larger inventories do not crowd out valid decks.
- Recommendation output is explicitly distinguished from tournament proof.

### Controlled testing

- Adaptive test queue prioritizing missing and weak Bey × opponent-archetype cells.
- Configurable de-prioritization of attack-versus-attack testing.
- Battle records for own Bey, opponent, archetype, result, finish, stadium, launch position, technique, notes, and contamination status.
- Relaunches, voids, and contaminated trials can be retained without inflating decided evidence.
- Per-deck history and deletion controls.

### Tournament analysis

- Wilson 95% confidence intervals rather than raw win rate alone.
- Overall, per-Bey, per-archetype, and Bey × archetype summaries.
- Point differential and finish-route evidence.
- Matchup-coverage matrix.
- Configurable evidence thresholds and readiness gates.
- Analysis of all six 3-on-3 order permutations.
- Weighted opponent-meta lineups.
- Deterministic empirical tournament forecast with explicit low-evidence status.

### Integrity and portability

- Browser-local data only; no analytics endpoint or application server.
- Schema-versioned state with migration from the earlier v1 format.
- Complete JSON backup with checksum.
- Backup import rejects checksum mismatches, then normalizes and migrates valid state.
- Catalog and state diagnostics, including orphan-battle and unknown-inventory detection.
- PWA manifest, SVG icon, PNG install icons, Apple touch icon, and offline service worker.

## Readiness model

Tournament readiness is gated by:

- construction legality;
- sufficient physical inventory;
- minimum decided battle count;
- minimum evidence per Bey;
- minimum evidence per core opponent archetype;
- Bey × matchup coverage;
- lower Wilson confidence-bound target;
- maximum contamination rate;
- optional evidence that each Bey can produce a two- or three-point finish;
- structural role spread.

The score remains a decision aid. Part wear, mold variation, launcher condition, launch execution, stadium condition, opponent skill, and actual event composition remain physical variables.

## Local verification

Requires Node.js 20 or later:

```bash
npm run check
```

Final automated result:

```text
18 tests
18 passed
0 failed
```

The release also passed a Chromium mobile workflow audit at 390 × 844:

```text
52 checks
52 passed
0 failed
```

The browser harness is included as `browser-audit.py`. It requires Python Playwright and Chromium. The machine-readable result is `browser-audit-result.json`.

For ordinary local use:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Catalog and rules maintenance

The seed catalog records a verification-through date of **2026-07-19**. Released entries are enabled by default; announced entries remain blocked unless theorycrafting is explicitly enabled. A static catalog cannot remain current indefinitely, so future additions should be applied through reviewed catalog patches or a new verified release.

The event organizer's published rules always supersede application presets.

Primary reference classes used for this release:

- Takara Tomy official Beyblade X regulation and official product lineup.
- World Beyblade Organization Beyblade X rules and format guidance.
- Secondary community part references only where official architecture naming was incomplete, with status kept separate from official rule claims.

## Release files

Runtime:

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

## Privacy, license, and trademarks

Inventory, decks, settings, meta profiles, and battle records stay in browser local storage. Export a backup before clearing browser data, moving browsers, or changing devices.

Application code is provided under the MIT License. Beyblade and Beyblade X are trademarks of their respective owners. X Deck Lab is independent and unofficial and contains no copyrighted product imagery.
