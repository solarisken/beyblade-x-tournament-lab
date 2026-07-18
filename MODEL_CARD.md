# Model card

## Purpose

Formulate and audit legal Beyblade X 3-on-3 decks from a manually entered physical collection, while clearly separating mechanical assumptions from physical evidence.

## Search

The engine generates all legal individual combinations available from the entered physical inventory, enforces physical allocation and repeated-part restrictions, explores several strategic pair frontiers, scans third slots, simulates finalists, and audits every recommended slot against the full generated replacement pool.

The deck search is broad and auditable, but is not represented as a formal proof of a globally optimal deck.

## Evidence model

- Mechanical profiles provide weak Beta priors.
- Direct matchup results update the exact combination at full weight.
- Conservative transfer is allowed through shared Blade, Ratchet, Bit, CX component, role, and system features.
- Posterior decision confidence is estimated by repeatedly sampling uncertain matchup rates for the leading legal decks.
- The test planner prioritizes matchups with high uncertainty and a material chance to change the deck decision.

## Readiness states

- **Hypothesis:** insufficient direct evidence.
- **Developing:** evidence is beginning to support the leader.
- **Contender:** every slot has direct evidence and the leader is reasonably stable.
- **Tournament-ready:** each slot has at least six direct battles, the deck has at least 24 direct battles, key threat groups are covered, the worst-field simulation clears its gate, and posterior leader probability is at least 74%.

These are local decision gates, not guarantees of tournament results.

## Limitations

Mechanical profiles remain author-assigned priors. Stadium, launch execution, wear, mold variation, player skill, and the actual event field can materially change results.
