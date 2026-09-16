---
status: superseded by ADR-0004
---
# Compatibility verdict as of July 2026

One definition of "compatible" is shared by the build script and the runtime: a pair is incompatible when their `geostyler-style` ranges have an empty intersection or when one lists the other as a peer dependency with an unsatisfied range (checked both directions). An ESM/CJS mismatch is a warning, never a failure. This model ignores `dependencies` between tracked packages, the `geostyler-data` axis, shared third-party peers such as `ol`, and transitive ranges, which the September 2026 review showed produces verdicts that contradict what upstream ships.
