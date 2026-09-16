---
status: accepted (2026-09-16), supersedes ADR-0003
---
# Pair verdicts come from three axes, not a compatible/incompatible bit

A pair of package versions is evaluated on three axes: the core-package ranges they declare (`geostyler-style`, `geostyler-data`), a declared dependency of one on the other, and any external peer they share (`ol`, `react`, `d3`). The aggregate is one of seven verdicts: Conflict, Risk, Duplicate, Compatible, Shipped together, Independent, Unknown (definitions in `CONTEXT.md`). Only a shared-peer Conflict breaks `npm install`; a core-range mismatch is a schema risk, because every package pulls its core package as a regular dependency and npm installs two copies. The two-state model called that "cannot be used together", which contradicted upstream: `geostyler@18.6.0` declares `geostyler-mapbox-parser@^6.1.1` while their `geostyler-style` ranges differ, so that pair is Shipped together and counts as compatible for recommendations. Pairs with no shared axis are Independent and pairs with no resolvable core range are Unknown; neither renders as a pass. ESM/CJS is no longer an axis: every tracked latest release is ESM and the only warnings came from a types-only package.

## Considered options

Keeping a binary verdict with declared dependencies as an override was rejected because it still hides Independent and Unknown behind green cells.
