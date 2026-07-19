# X Deck Lab 2.3.0

X Deck Lab is a root-only, mobile-first GitHub Pages PWA for Beyblade X inventory, three-Bey deck building, owned-parts battle testing, physics-informed recommendations, and tournament-readiness analysis.

Version 2.3.0 simplifies the normal player experience so children and first-time users can follow it without understanding the advanced analytics. The app still runs entirely in the browser, with no build step, server, account, telemetry, or external runtime dependency.

## The four-step player path

1. **Parts** — Add boxed products or loose parts that you actually own.
2. **Decks** — Build three Beys manually or apply a legal suggested deck made from owned parts.
3. **Test** — Tap the first test card, assemble the two shown Beys, battle once, and save the result.
4. **Analysis** — Check the green readiness items and follow the remaining instructions.

The home screen shows these four steps and marks completed steps. A **How to use** button opens the full guide at any time.

For younger players, the normal path is **Parts → Decks → Test → Analysis**. The **More** screen contains advanced rules, thresholds, backups, and catalog tools and can be handled by an adult or experienced player.

## Ordinary Self-KO recording

The battle form asks one question only:

> Did your Bey go out by itself? — **Yes** or **No**

Choose **Yes** when your own Bey jumps or runs out mostly by itself. No cause, subtype, or technical classification is required.

The app prevents contradictory answers: Self-KO = Yes is accepted only for an Over or Xtreme loss. A self-KO remains a valid competitive loss. Exclude a battle only when the test itself was not fair, such as an accidental touch, wrong setup, or unusable launch.

Older records containing detailed self-KO causes remain readable and are safely normalized into the ordinary flag when the prior record is unambiguous. Unknown legacy KOs are not guessed.

## Guided battle form

The five required choices are numbered:

1. Your Bey
2. Owned opponent
3. Winner
4. Finish
5. Self-KO — Yes or No

Engineering explanations and optional stadium, position, launch-style, exclusion, and notes fields are collapsed by default. They remain available in expandable sections without blocking the simple workflow.

## Testing and deck optimization

- Every generated opponent is a complete Bey made from recorded owned parts.
- The selected Bey and opponent must be buildable at the same time from available quantities.
- Attack-bit versus attack-bit tests are excluded by default.
- Test plans prioritize missing matchup evidence and straightforward self-KO checks.
- Suggested decks must pass legality and owned-inventory capacity checks.
- Recommendations combine saved battle evidence with qualitative engineering proxies for movement, impact, rotational inertia, spin retention, stability, control, recoil, self-KO risk, ratchet height, and matchup coverage.

The engineering model is a ranking aid, not a rigid-body or measured-RPM simulator. Exact mass distribution, launch speed, friction, impact restitution, mold variation, wear, stadium condition, and player execution are not available. Controlled battle results remain the tournament-readiness authority.

## Other platform capabilities

- Basic, Unique, Custom Line, expanded Custom Line, ratchet-integrated blade, and ratchet-integrated bit architectures
- Versioned deck library with rename, clone, and delete controls
- Takara Tomy and WBO-oriented legality profiles plus custom event profiles
- Exact-opponent and archetype matchup coverage
- Wilson win-rate intervals
- Multi-point finish checks
- Deck-order optimization
- Empirical match forecasting
- Meta-lineup management
- Checksum-protected backups
- Catalog patches with duplicate-reference validation
- Offline PWA operation
- Migration from earlier state schemas

## Deploy on GitHub Pages

1. Create or open a GitHub repository.
2. Upload every file from the release ZIP directly to the repository root.
3. Do not place the files in `src`, `public`, `dist`, or another wrapper directory.
4. In **Settings → Pages**, deploy from the branch root.
5. Open the published page online once so the service worker can cache the application shell.

## Verification

Node.js is required only for release testing.

```bash
npm run check
```

Certified result:

```text
34 tests
34 passed
0 failed
```

Run the Chromium mobile workflow audit with:

```bash
python browser-audit.py
```

Certified result:

```text
70 checks
70 passed
0 failed
```

The audit covers 390 × 844 mobile use and an additional 320-pixel small-phone overflow check.

## Data maintenance

- Released parts are enabled by default.
- Announced parts remain blocked unless theorycrafting is enabled.
- Catalog patches can add parts and products without rebuilding the application.
- Imported backups are checksum-verified before state replacement.
- The bundled catalog was verified through **2026-07-19**. Recheck rules and product status for later events.

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

Audit screenshots are distributed separately and are not required for deployment.

## Privacy, license, and trademarks

Inventory, decks, settings, meta profiles, and battle records remain in local browser storage. Export a backup before clearing browser data or changing devices.

Application code is provided under the MIT License. Beyblade and Beyblade X are trademarks of their respective owners. X Deck Lab is independent and unofficial and contains no copyrighted product imagery.
