# X Command Center 1.1.0 — Release Audit

Audit date: **2026-07-20**

## Release decision

**PASS** — the package satisfies its defined functional, evidence, data-integrity, mobile-layout, and offline-deployment checks.

This certification applies to the exact files listed in `SHA256SUMS.txt`.

## Product requirements checked

### Command-center information architecture

- Readiness, next action, blockers, deck status, and priority tests are consolidated into the Command view.
- Collection, Deck Lab, Test Lab, and Records remain task-specific workspaces.
- Advanced settings, backup, rules selection, and theorycrafting controls remain secondary.
- No standalone Analysis tab interrupts the primary workflow.

### Collection integrity

- No ownership is assumed on first launch.
- Product quantities and loose-part quantities are additive.
- Catalog-only entries do not manufacture incomplete part inventories.
- Loose-part selection is category-dependent.
- Announced parts remain unavailable unless theorycrafting is enabled.

### Construction and legality

- Standard and ratchet-integrated Bey architectures are completeness-checked.
- Custom and expanded Custom Line records are supported by the core data model.
- A three-Bey deck is rejected for incomplete constructions.
- Duplicate functional parts are rejected under duplicate-restricted profiles.
- Owned inventory capacity is checked independently from rules legality.
- Optimizer output must be complete, legal, and supplyable from owned quantities.

### Testing controls

- Every generated opponent is a complete Bey.
- Own Bey and opponent quantities are reserved together before a mission is accepted.
- Attack-movement bit mirrors remain eligible when simultaneously buildable and otherwise legal.
- Test priorities use evidence gaps and controlled queue rotation.
- The exact mission completed most recently cannot remain first when another eligible mission exists.
- Recently reused opponent signatures and part families are penalized.
- Ordinary self-KO is recorded as one Yes/No field.
- Self-KO = Yes is valid only for an Over or Xtreme loss by the user's Bey.
- Excluded trials do not enter decided-evidence calculations.

### Evidence model

- Wilson lower confidence bound is calculated from decided outcomes.
- Per-Bey and matchup coverage are evaluated separately.
- Observed self-KO rate is surfaced as a release gate.
- Engineering proxy scores cannot independently produce a strong readiness classification without battle evidence.
- Model limitations are visible in the product documentation.

### Data portability and privacy

- State is local-browser only.
- JSON export/import is available.
- Battle history can be exported to CSV.
- No analytics endpoint, user account, or application server is required.
- GitHub Pages root deployment is supported.
- Service worker caches the application shell for offline use.
- Mission evidence maps and render-cycle queue caching reduce repeated mobile computation.

## Automated unit and rules checks

Command:

```bash
npm run check
```

Result:

```text
14 tests passed
```

Validated cases:

1. Part IDs are unique.
2. Product IDs are unique.
3. Standard and ratchet-integrated completeness rules behave correctly.
4. Product inventory aggregation returns expected quantities.
5. A legal owned deck passes construction and supply checks.
6. A duplicated functional part is rejected under duplicate restrictions.
7. Ordinary self-KO validation rejects contradictory records.
8. Wilson lower-bound output is bounded and conservative.
9. Generated opponents are complete and simultaneously supplyable.
10. Attack-movement bit mirror missions remain eligible.
11. Legacy state migration removes the retired exclusion setting.
12. The just-completed exact pairing does not immediately repeat when alternatives exist.
13. The optimizer returns legal, owned-inventory decks.
14. Readiness cannot become strong without empirical evidence.

## Chromium workflow audit

Command:

```bash
python3 browser-audit.py
```

Result:

```json
{
  "passed": 31,
  "failed": 0,
  "errors": []
}
```

The audit uses an in-memory application shell because this execution environment blocks local HTTP navigation. It still runs the production HTML, CSS, catalog, core engine, and application JavaScript in Chromium, with a localStorage-compatible in-memory implementation.

Validated workflow:

- app initialization and title rendering;
- five-item navigation;
- initial Command view and readiness hero;
- collection navigation and owned-product changes;
- Deck Lab navigation;
- optimizer dialog and legal deck result;
- optimized deck application;
- three complete Bey previews;
- Test Lab navigation;
- multiple complete owned-opponent missions;
- mission selection and battle save;
- local state persistence;
- immediate-pairing anti-repeat behavior;
- Records navigation and saved record rendering;
- settings dialog;
- attack-movement mirror eligibility;
- no horizontal overflow at 390 × 844, 320 × 720, and 1280 × 900;
- no uncaught browser or console errors.

## Manual visual review

Reviewed release previews:

- `mobile-command-center.png`
- `small-phone-command-center.png`
- `desktop-command-center.png`

Observed:

- fixed bottom navigation remains reachable on mobile;
- primary action cards maintain readable hierarchy;
- touch targets remain appropriately sized;
- desktop content uses additional width without turning the interface into a dense table dashboard;
- mobile evidence coverage renders as compact cards instead of requiring horizontal table scrolling;
- dialog controls and form labels are visible and unambiguous;
- iOS form controls use a 16 px input size to avoid focus zoom;
- the selected battle form is brought into view after mission selection on small screens.

## Known boundaries

- The bundled product library is a curated starter catalog, not a permanent exhaustive release database.
- Engineering metrics are qualitative dimensionless proxies, not measured physical simulation outputs.
- Manufacturing variation, wear, launcher condition, launch execution, stadium condition, and player skill remain uncontrolled external variables.
- Tournament-organizer rulings override bundled presets.
- Browser storage can be erased by the user or operating system; backups remain necessary.

## Final disposition

No release-blocking defect was found in the tested scope. The package is suitable for static deployment and controlled player testing, subject to the catalog and empirical-model boundaries above.
