# X Deck Lab 3.2.1

A root-only, mobile-first Beyblade X tournament coach for GitHub Pages.

## Player workflow

1. Add official releases or loose parts you own.
2. Build or generate a legal three-Bey deck.
3. Follow the single recommended owned-opponent test.
4. Record the battle and answer ordinary Self-KO with Yes or No.
5. Open Coach to see the updated mission, evidence progress, strengths, and gaps.

## UI and UX design

Version 3.2.1 is a focused refinement of the coach-first workflow:

- Five permanent bottom-navigation actions: Home, Parts, Decks, Test, and Coach.
- Guide, Easy/Pro mode, connection status, and advanced controls are placed in the compact header.
- Home uses a short four-step progress path, one readiness card, three evidence summaries, and one recommended battle.
- Completed setup steps no longer create a duplicate “open Coach” card.
- Saving a battle shows an explicit **See Coach update** handoff.
- Coach combines progress, strengths, and improvement priorities in one snapshot.
- Battle patterns and the engineering guide use expandable sections.
- Technical analysis remains collapsed in Easy mode.
- The release library keeps search visible while filters and ordering stay in an expandable sticky drawer.
- Owned products have stronger visual distinction for faster collection scanning.

## Release-date collection library

The Parts screen contains Takara Tomy Japan products verified through 2026-07-20.

Inclusion rule:

- Include a release when it contains at least one Beyblade performance part.
- This includes starters, boosters, random boosters, deck sets, customize sets, collection sets, and parts-only packs such as official Bit Sets.
- Exclude accessory-only products containing no Beyblade performance parts, including launcher-only, stadium-only, case-only, and sticker-only releases.

The bundled catalog contains 125 qualifying product records: 120 released and 5 announced at the verification date.

## Testing and optimization

- Generated opponents use owned parts and must be buildable at the same time as the selected test Bey.
- Attack-bit versus attack-bit tests are excluded by default.
- Test priority considers uncertainty, exact-opponent evidence, opponent-type coverage, per-Bey evidence, self-KO checks, and information value.
- The exact pairing just completed is put on cooldown when another legal owned pairing exists; recently reused opponent parts also receive a diversity penalty.
- Repetition returns later when additional samples are still statistically useful, and remains available immediately when no alternative owned test exists.
- Tournament-order recommendations use vertical, wrapping sequences rather than horizontally scrolling chips.
- Deck suggestions optimize the complete three-Bey lineup under legality, inventory, role coverage, matchup coverage, and modeled self-KO constraints.
- Engineering values are qualitative proxies. Controlled physical battles remain the readiness authority.

## Deployment

Upload all files from the release ZIP directly to the GitHub repository root. Configure GitHub Pages to deploy the `main` branch from `/ (root)`. No build step is required.

## Verification

```bash
npm test
python browser-audit.py
```
