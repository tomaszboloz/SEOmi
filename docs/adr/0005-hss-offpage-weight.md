# ADR 0005: Off-page evidence stays outside HSS v1 (GEM-93-09)

Status: Accepted by owner delegation (2026-11-01). Issue #93; register #83.

## Context
HSS v1 (`src/services/hss/profile.ts`, profile `hss-gemini-7`) has seven modules whose weights sum to 1: SFS, TAS, IGOS, SPRS, EETV, SIJA, AIOR. TBVA, co-citation and mention stance (`src/services/offPage/`) are measured, but they depend on a bounded sample of at most 25 backlink sources, on a provider that may be unavailable, and on a model-specific embedding space.

## Decision
1. TBVA and co-citation are **not** an HSS module in profile v1. They are reported next to HSS, with their own status, provenance and limitations.
2. Changing HSS weights needs a new profile id and version (`hss-gemini-8`); history from v1 is never rescored.
3. If TBVA is added later, it enters only as a module that can be `unavailable`; the existing renormalisation over measured modules and the 0.5 minimum-weight gate apply unchanged.
4. A candidate weight is calibrated on fixtures first. No value is chosen without a measured effect on the rank correlation of existing fixtures.
5. Alias and homonym rules (`aliasSense.ts`) are user evidence. They change which mentions count, never the TBVA formula.

## Consequences
HSS stays comparable across versions. Off-page evidence is visible but cannot silently move the headline score. The owner can replace this decision by a new ADR.
