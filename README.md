# Beyblade X Tournament Lab PWA v7

Version 7 separates collection, builds, and research data.

Default state:
- Bundled owned collection only
- No saved builds
- No tests
- No match data
- No research projects

Reset options:
- New Season: keeps collection; deletes builds and all research
- Reset Research: keeps collection and builds; deletes matches/tests/history
- Factory Reset: restores bundled collection baseline and deletes everything else

Separate exports:
- Full backup
- Collection only
- Builds only
- Research only

Optional build templates can be loaded manually.


Version 7.1 fixes the IndexedDB library-store startup failure and adds a visible startup error boundary.
