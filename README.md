# X Tournament Director · Evidence First

A zero-cost, local-first Beyblade X tournament decision system.

## Core workflow

1. **Collection** — starts empty. Add only owned sets and loose parts.
2. **Deck** — Autopilot generates legal combinations, allocates physical parts, searches legal decks, audits alternatives, and reports posterior decision confidence.
3. **Match** — use the registered deck, opponent scout, and first-to-four score sheet.

The Deck screen now distinguishes four evidence states: **Hypothesis**, **Developing**, **Contender**, and **Tournament-ready**. It does not call a prior-only recommendation proven.

The validation planner selects the next three-battle test based on uncertainty, meta weight, and the probability that the result can change the leading deck. Runner-up combinations may be selected when testing them has more decision value than retesting the current deck.

No backend, account, API key, paid AI, or network connection is required after download.
