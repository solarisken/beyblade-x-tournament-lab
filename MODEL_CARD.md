# Model card

## Initial recommendation

Before physical evidence is recorded, the coach ranks legal owned-part decks using heuristic mechanical profiles, matchup coverage, backup coverage, finish-route potential, control, role diversity, recoil risk, and order resilience.

## Evidence hierarchy

Evidence is weighted in this order:

1. Exact combination
2. Blade/core and Blade–Bit pairing
3. Bit
4. Ratchet and shared components
5. Role and system

Transferred evidence is capped below exact-combination evidence.

## Matchup model

Attack, Stamina, Defense, and Balance opponents maintain separate posterior estimates. Results against one profile do not receive full weight against a different profile.

## Readiness

Tournament-ready requires:

- legal simultaneous allocation;
- direct evidence for every recommended Bey;
- sufficient total direct battles;
- evidence against every threat profile;
- adequate posterior decision confidence.

## Limits

The starting mechanical profiles are modeled assumptions, not official performance statistics. Real stadium testing remains the authoritative input.
