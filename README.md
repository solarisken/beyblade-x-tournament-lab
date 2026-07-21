# X Command Center 1.1.0

X Command Center is a mobile-first, offline-capable Beyblade X tournament workspace. It combines collection management, legal 3on3 deck construction, owned-parts opponent testing, anti-repetition test planning, battle records, and evidence-based readiness guidance in one operational dashboard.

The app is an independent, unofficial tool. It does not transmit inventory or battle data and does not include copyrighted product imagery.

## Command-center workflow

1. **Collection** — Record official products or loose parts that are physically owned.
2. **Deck Lab** — Build three Beys manually or apply a ranked, legal, inventory-supplyable suggestion.
3. **Test Lab** — Follow generated missions using complete opponents assembled only from remaining owned parts.
4. **Records** — Save outcomes, finish routes, ordinary self-KOs, test exclusions, and optional launch context.
5. **Command** — Review legality, evidence coverage, self-KO exposure, matchup gaps, and the next recommended action.

Readiness analysis is integrated into the Command view rather than exposed as a disconnected analytics screen.

## Smart testing behavior

- The selected Bey and its opponent must be buildable at the same time from recorded quantities.
- All legal movement-bit matchups remain eligible, including attack-movement bit versus attack-movement bit tests.
- A just-completed exact pairing is not offered as the next mission when another legal owned pairing exists.
- Recently reused opponent combinations and recently reused opponent parts receive queue penalties.
- Mission generation precomputes evidence counts and reuses one queue calculation per render cycle to reduce mobile CPU work.
- Missing Bey × matchup evidence and low-sample opponents receive priority.
- Ordinary self-KO recording is a single **Yes / No** choice.
- **Yes** is accepted only when the user's Bey loses by Over or Xtreme finish.
- Excluded or invalid trials remain in history but do not count as decided evidence.

## Deck optimizer

The optimizer searches combinations made from the recorded inventory and rejects decks that fail:

- completeness;
- active rules-profile legality;
- duplicate-functional-part restrictions;
- inventory-capacity requirements.

Candidates are ranked using transparent qualitative proxies for impact potential, movement, rotational inertia, spin retention, stability, KO resistance, burst resistance, control, recoil risk, self-KO risk, role diversity, and matchup coverage.

These scores are hypothesis-ranking aids. They are not rigid-body simulations and cannot replace controlled physical testing. The application has no measured launch RPM, material friction coefficients, exact mass distribution, mold variation, wear calibration, or stadium-condition measurements.

## Evidence and readiness

The Command view evaluates separate gates rather than treating an engineering score as proof:

- deck legality and physical supply;
- total decided battles;
- per-Bey evidence;
- matchup coverage;
- Wilson 95% lower confidence bound;
- observed self-KO rate;
- multi-point finish evidence;
- excluded-test rate.

A high readiness score remains a decision aid, not a tournament guarantee.

## Catalog boundary

The included product records are a curated starter catalog checked through **2026-07-20**. They are not presented as a permanently exhaustive release database. Products with incomplete verified mappings are catalog-only and do not fabricate owned parts. Missing products or releases can be represented through loose-part entry or a future catalog update.

Announced parts are disabled by default and are available only when theorycrafting is explicitly enabled.

## Rules basis

The default Takara Tomy profile is based on Regulation v12 and the official scoring model:

- Xtreme Finish — 3 points
- Over Finish — 2 points
- Burst Finish — 2 points
- Spin Finish — 1 point

A conservative WBO-oriented profile is also included. Event-specific organizer rules remain authoritative.

Primary references:

- Takara Tomy Beyblade X Regulation v12: https://beyblade.takaratomy.co.jp/beyblade-x/_image/regulation.pdf
- Takara Tomy official product lineup: https://beyblade.takaratomy.co.jp/beyblade-x/lineup/
- World Beyblade Organization Beyblade X rules: https://worldbeyblade.org/Thread-Beyblade-X-Rules

## Deployment — repository root only

There is no build step or server-side application.

1. Extract the release ZIP.
2. Upload every extracted file directly to the root of a GitHub repository.
3. Open **Settings → Pages**.
4. Select **Deploy from a branch**.
5. Choose the relevant branch and **/ (root)**.
6. Save and open the published URL once so the service worker can cache the application shell.

Do not place the release files inside `src`, `public`, `dist`, or another wrapper folder.

For ordinary local use:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Verification

Node.js is needed only for release checks:

```bash
npm run check
```

Certified release result:

```text
14 tests passed
```

Chromium workflow audit:

```bash
python3 browser-audit.py
```

Certified release result:

```text
31 checks passed
0 failed
0 browser errors
```

The browser audit covers:

- 390 × 844 mobile workflow and form interaction;
- 320 × 720 small-phone overflow and compact navigation;
- 1280 × 900 desktop overflow;
- mobile coverage-card rendering without horizontal table dependence;
- minimum 44 px primary touch targets;
- collection entry;
- deck optimization and application;
- legality validation;
- owned-opponent mission generation;
- battle saving;
- immediate-pairing anti-repeat behavior;
- record rendering;
- attack-movement mirror eligibility;
- uncaught browser and console errors.

## Data and privacy

All state remains in the browser's local storage under `xCommandCenterStateV1`. Version 1.1 migrates older state and removes the retired attack-mirror exclusion setting without deleting collection, deck, or battle data. Use JSON export before clearing browser data, changing browsers, or moving devices. Import replaces current app data after validation.

## Root files

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
- `.nojekyll`

Verification and documentation:

- `test.mjs`
- `browser-audit.py`
- `browser-audit-result.json`
- `README.md`
- `AUDIT.md`
- `SHA256SUMS.txt`
- `LICENSE`

Preview images are included for review but are not required at runtime.

## License and trademarks

Application code is provided under the MIT License. Beyblade and Beyblade X are trademarks of their respective owners. X Command Center is independent and unofficial.
