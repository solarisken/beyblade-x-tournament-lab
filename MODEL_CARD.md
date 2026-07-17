# Model Card

## Purpose

X Deck Lab V3 is a local decision-support tool for selecting and testing a Beyblade X 3-on-3 deck from a known owned collection.

## Inputs

- Owned physical products and their component parts.
- Official format constraints.
- Weak qualitative signals derived from official product descriptions.
- User-recorded physical battle batches.
- User settings for search depth, lab scale, and test batch size.

## Outputs

- A legal 3-on-3 allocation.
- Decision score and matchup redundancy indices.
- Critical-finish floor across all three Beys.
- Scenario-model stress results and first-order recommendation.
- Adaptive physical-test queue.
- Evidence confidence status.

## Non-claims

The app does not claim that:

- its mechanistic part values are measured performance statistics;
- simulated matches establish tournament win probability;
- a locally validated deck will reproduce the same results in another stadium, launcher environment, or player pool;
- a zero-evidence baseline is tournament proven.

## Evidence method

Physical evidence starts from a neutral Beta prior. Exact matchup rows have full weight; remote archetype rows provide only weak shrinkage. Evidence influence grows with effective sample size. Finish routes and self-KO events are tracked separately.

## Optimization method

Fast mode uses a broad dominance-screened set and clearly reports that it is incomplete. Deep mode enumerates every legal allocation from the encoded owned inventory and official duplicate-part constraints.

## Known limitations

- Mechanistic traits are qualitative and require calibration through physical results.
- Generic opponent stress profiles are not a substitute for an exact local metagame list.
- Stadium wear, launcher condition, part wear, player execution, and manufacturing variance are not automatically measured.
- Deep exhaustive mode can be computationally expensive on phones.
