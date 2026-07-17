# X Deck Lab V3

A zero-cost, GitHub Pages-ready Beyblade X 3-on-3 decision system for the confirmed owned collection:

`UX-14, CX-16, UX-19, UX-08, CX-09, CX-10, BX-23, UX-11, BX-49`

V3 is built around mechanical legality, conservative ranking, adaptive physical testing, and an automated tournament lab. It does not present simulated results as tournament proof.

## Material corrections from V2

- CX-16 is modeled as the four-part CX Expand Blade system: Bahamut Lock, Break Over, Blitz Metal, and Knuckle Assist.
- Those CX-16 components can be combined legally with the owned Sol/Wolf locks and Dual/Free/Knuckle assists according to their component resources.
- BulletGriffon has an integrated ratchet and can never receive a separate ratchet.
- The two physical 9-60 copies are both recorded as owned, but official 3-on-3 duplicate-part rules allow only one 9-60 in the deck.
- The official first-to-four point structure is used: Spin 1, Over 2, Burst 2, Xtreme 3.
- After the first three battles, the lab rebuilds the order when neither player has won instead of repeating one fixed cycle.

## Search modes

### Fast dominance-screened

Runs automatically. It preserves strong options from every legal blade assembly, screens a broad candidate set, and optimizes for:

- primary matchup coverage;
- backup matchup coverage;
- weakest backup;
- conservative lower signals;
- critical-finish access on every Bey;
- self-KO control;
- evidence support.

This mode is not labeled exhaustive.

### Deep exhaustive allocation audit

Enumerates the complete owned-parts allocation space:

- 33 legal blade assemblies;
- 2,025 legal individual combinations;
- 1,109 legal blade triples;
- 95,954,544 legal 3-on-3 allocations.

It is cancellable and shows progress. Desktop use is recommended.

## Smart Coach Auto-Pilot

Auto-Pilot performs the full decision cycle:

1. validate mechanical legality;
2. generate legal combinations;
3. optimize the deck;
4. run all six blind first orders in the Tournament Lab;
5. model order rebuilding after the first three battles;
6. identify the largest redundancy gap;
7. generate short adaptive physical-test batches;
8. rescore automatically after each committed batch.

## Evidence policy

Part descriptions generate only weak mechanistic decision signals. Physical results use neutral evidence posteriors. The app reports separate statuses:

- Hypothesis
- Developing
- Supported
- Validated locally

These statuses describe evidence collected in the user's environment. They are not external tournament guarantees.

## Deploy on GitHub Pages

1. Create a public GitHub repository.
2. Upload the contents of this folder to the repository root.
3. Open **Settings → Pages**.
4. Select **GitHub Actions** under Build and deployment.
5. Push to `main` or run the included deployment workflow manually.

## Local use

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.

## Verify

Node 22 or later:

```bash
npm run verify
npm run baseline
```

No package installation is required.
