# GeoStyler Compatibility

A dashboard that tells a developer which versions of the GeoStyler packages they use work together, and what to install. All data comes from the npm registry at build time.

## Language

### Packages

**Core package**:
A package that defines a schema other packages consume: `geostyler-style` (styles) or `geostyler-data` (features).
_Avoid_: contract package, base package

**UI package**:
A React library that consumes styles and data and declares parsers as dependencies: `geostyler`, `geostyler-legend`.
_Avoid_: UI component, consumer

**Style parser**:
A package that converts between `geostyler-style` and one style format (SLD, Mapbox GL, QGIS, OpenLayers, LYRX).

**Data parser**:
A package that converts between `geostyler-data` and one data format (GeoJSON, WFS, Shapefile).

**Tracked package**:
A package in the dashboard's dataset. The list is fixed in code; `geostyler-cql-parser` is not tracked because users do not install it directly.

**Types-only package**:
A package that ships only TypeScript declarations, such as `geostyler-data`. It has no module system.
_Avoid_: CJS package (for these)

**Prerelease**:
A version with a `-next`, `-beta` or similar tag. Hidden by default everywhere and never recommended while a stable version exists. One global toggle, "Show prereleases", stored as a browser preference and never in the URL, reveals them in grids and version controls.

### Pages

**Stack builder**:
The landing page, labelled "Check compatibility" in the header. Takes a stack and optional pins, returns a version set, an install command and the bottleneck.
_Avoid_: overview, dashboard, compare

**Latest releases grid**:
The stack builder's empty state. Every tracked package's latest release against every other, one verdict per cell. Stable releases only unless the prerelease toggle is on.

### Selection

**Stack**:
The set of tracked packages a user says they use. The landing page's input.
_Avoid_: selection, selected packages

**Pin**:
A version the user fixes for one package in their stack. The recommendation must keep it. A pin on a version the dataset does not have is left out and reported.

**Failing pair**:
A pair in the closest rejected attempt whose verdict is Conflict, Risk, Duplicate or Unknown. Shown when no version set exists, with the pin to relax: the pinned package in the most failing pairs.

**Partial set**:
A version set for the stack minus one package, offered when no set exists. The pin to relax is removed first, then each stack package in order; the first removal that leaves a set wins.

**Version set**:
One version per package in the stack. The landing page's output when every pair in it is Compatible, Shipped together or Independent.
_Avoid_: combination, recommended versions

**Anchor**:
The core package version a version set agrees on, one per core package the stack constrains. The engine searches anchors newest-first, `geostyler-style` outer and `geostyler-data` inner.

**Bottleneck**:
The stack package whose removal moves the anchor furthest forward. Named, with the anchor the set would reach without it, whenever a version set passes over a newest release; absent when every chosen version is the newest or no single removal helps.

### Pair evaluation

**Axis**:
One dimension along which a pair of package versions is compared. There are three: core range, declared dependency, shared peer.

**Core range**:
The version range a package version declares on a core package.
_Avoid_: geostyler-style range (when speaking generally)

**Transitive range**:
A core range a package version inherits through a declared dependency when it declares none itself. Resolved only from the tracked dataset.

**Declared dependency**:
One tracked package listing another tracked package in its `dependencies`, with a range.
_Avoid_: peer dependency (that term is reserved for shared peers)

**Shared peer**:
An external package that both members of a pair list in `peerDependencies`, for example `ol`, `react`, `d3`. Only one copy can exist in a project.

**Verdict**:
The aggregate outcome for one pair of package versions. Exactly one of the values below.
_Avoid_: compatible/incompatible as a binary, status

**Conflict**:
Verdict when shared peer ranges are disjoint. Installation fails.

**Risk**:
Verdict when core ranges differ and neither package declares the other. Style or data objects may have a different schema.

**Duplicate**:
Verdict when one package declares the other but the chosen version does not satisfy the range. Two copies get installed.

**Compatible**:
Verdict when core ranges intersect and shared peers intersect.

**Shipped together**:
Verdict when core ranges differ but one package declares the other in a satisfied range. Upstream builds and tests this pair. Treated as Compatible for recommendations, shown with its own label. In a version set, a Risk pair also counts as Shipped together when a third chosen version declares both members in satisfied ranges (sld-parser and mapbox-parser through geostyler).

**Independent**:
Verdict when the pair shares no axis. Not a pass; nothing was checked.

**Unknown**:
Verdict when a package version declares no core range and none resolves transitively.
