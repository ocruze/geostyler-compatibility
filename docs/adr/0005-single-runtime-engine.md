---
status: accepted (2026-09-16)
---
# One compatibility engine, run in the browser

The build step only fetches npm metadata and writes a trimmed `src/data/packages.json` (per version: number, date, prerelease flag, core ranges with their source, declared dependencies on tracked packages, peer dependencies). Every verdict, version set, and the latest releases grid is computed at runtime from that file. The precomputed `compatibility-matrix.json` and `scripts/compute-compatibility.ts` are removed. Two engines were how the July 2026 definition of "compatible" drifted between build and runtime, and the matrix file duplicated the whole dataset in the bundle. Twelve packages by a few dozen versions is a few thousand pair checks, well within a frame. Transitive core ranges are the one exception: they are resolved at build time because resolution needs the whole dataset, and the result is stored with a `source` field so the UI can name where a range came from.
