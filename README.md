# X Tournament Director — Evidence Coach 3.0

This release upgrades the coach's decision model rather than adding more dashboard features.

## Implemented

- Hierarchical evidence transfer across exact combinations, Blade/core, Ratchet, Bit, Blade–Bit pairing, role, system, and shared CX components.
- Separate matchup records against Attack, Stamina, Defense, and Balance profiles.
- Adaptive three-battle testing selected by uncertainty and its chance to change the deck.
- Automatic testing stop rules when the recommendation becomes sufficiently stable.
- Evidence-driven launch orders for unknown, Attack-first, Stamina-first, Defense-first, and Balance-first opponents.
- Decision confidence and visible readiness gates.
- Exact explanations when the recommended deck changes or holds.
- Finish type, points, self-KO, launch error, launch technique, stadium position, and meaningful-contact recording.
- Attack-Bit versus Attack-Bit test exclusion.
- Empty first launch, with optional migration of inventory and evidence already stored by the previous V2 app.

## Important

Mechanical values remain priors. Physical evidence progressively takes authority, but the application does not claim that an untested recommendation is tournament-proven.
