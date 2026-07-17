# Beyblade X Tournament Lab V4

Version: 4.0.0

V4 is the strongest owned-pool optimization build. It replaces role-based drafting with exhaustive legal build generation and low-gap 3-on-3 deck optimization.

## Core objective

Build the strongest serious tournament deck from the recorded owned collection while reducing internal gaps between the three Beys.

The default objective rewards:

- a high weakest-Bey floor;
- a high average candidate score;
- balanced Attack, Stamina, and Defense coverage;
- a small performance gap between deck members;
- a small role-coverage gap;
- a small evidence gap;
- legal role diversity;
- official 3-on-3 no-duplicate-part compliance.

DranStrike is enforced as the anchor whenever it is owned. The other two Beys are optimized around it to raise the floor and close the remaining gaps.

## Exhaustive build generation

V4 generates:

- every owned Standard Blade × Ratchet × Bit combination;
- every owned CX Lock Chip × Main Blade × Assist Blade × Ratchet × Bit combination;
- every owned CX Expand Lock Chip × Over Blade × Metal Blade × Assist Blade × Ratchet × Bit combination;
- every owned CX Integrated Lock Chip × Main Blade × Assist Blade × integrated Ratchet/Bit combination.

Every generated build receives a transparent score based on:

- mechanical role priors;
- stock-product role priors;
- exact or inherited controlled-match evidence;
- launch/self-exit reliability;
- versatility;
- uncertainty penalty.

Recorded evidence progressively overrides generic priors.

## 3-on-3 optimizer

After generating every legal build, V4 creates a dominance-pruned candidate frontier. It then evaluates every official-legal three-Bey combination within that frontier.

The selected deck maximizes:

- 30% weakest-Bey floor;
- 18% average strength;
- 18% role-coverage floor;
- 13% small performance gap;
- 10% small role-coverage gap;
- 6% small evidence gap;
- 5% role diversity.

The Deck page displays:

- objective score;
- low-gap index;
- weakest-Bey floor;
- performance gap;
- coverage gap;
- evidence gap;
- top alternative decks;
- complete scoring rationale.

## Official 3-on-3 legality

V4 implements the Takara Tomy BEYBLADE X Regulation, 12th edition, March 2026:

- three Beys are required;
- the same restricted part cannot appear more than once across the deck, including color variants;
- Custom Line Lock Chips may repeat except Valkyrie and Emperor;
- physical owned quantity is still enforced.

Official sources:

- https://beyblade.takaratomy.co.jp/beyblade-x/_image/regulation.pdf
- https://beyblade.takaratomy.co.jp/beyblade-x/event/ex/xtremepop.html

## Smart Coach

The Smart Coach manages:

1. confirmed-collection loading;
2. optimizer invalidation when collection or evidence changes;
3. exhaustive recalculation;
4. best-deck application;
5. official legality repair;
6. weakest/least-certain member selection;
7. contrasting opponent selection;
8. adaptive 4–16 match testing;
9. early pass, rejection, or inconclusive decisions;
10. one-variable repair recommendations;
11. automatic re-optimization after repairs;
12. final deck review.

## One-variable repair

After a matchup rejection, V4 searches generated candidates that differ by exactly one component. It ranks repairs by:

- deck-objective improvement;
- low-gap-index improvement;
- continued official legality.

This avoids uncontrolled multi-part changes.

## Scope and honesty

The optimizer is strongest within the recorded owned pool and recorded controlled evidence. Mechanical priors are transparent heuristics, not laboratory measurements. “Serious Candidate” is not a claim of universal metagame dominance without external opposition.

## Data compatibility

V4 keeps the existing IndexedDB name and upgrades it to schema version 4. Existing collection, builds, tests, matches, projects, notebook entries, and coach logs are preserved. A new `optimizationRuns` store is added.

## Deployment

1. Delete the existing repository files.
2. Extract this ZIP.
3. Upload the extracted contents to the repository root.
4. Confirm these files exist at the root:
   - index.html
   - reset-cache.html
   - styles.css
   - sw-v4.js
   - js/app.js
   - js/analytics.js
   - js/optimizer.js
   - js/db.js
   - data/products.json
   - data/rules.json
   - data/optimizer-model.json
   - data/version.json
5. Commit and wait for GitHub Pages.
6. Open:
   https://solarisken.github.io/beyblade-x-tournament-lab/reset-cache.html

## Verification

The app must show:

- Version 4.0.0
- V4 ACTIVE
- Smart Coach card above every page
- Run Strongest Optimizer on the Deck page
- DranStrike anchor notice
- low-gap metrics and alternative decks

## Validation performed

- JavaScript syntax checks for app, analytics, optimizer, database, and service worker;
- anchored optimizer smoke test on the confirmed collection;
- official duplicate-part legality tests;
- Custom Line Lock Chip exception tests;
- generated-deck legality verification;
- JSON integrity checks;
- static asset path checks.
