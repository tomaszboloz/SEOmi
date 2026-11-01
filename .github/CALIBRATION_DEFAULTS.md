# Calibration defaults and how to re-calibrate (#52, #81, #82, #139, #72)

Decision date 2026-11-01, accepted by owner delegation (register: `src/services/scoreProfiles/decisions.ts`).
No real client crawl ships with this repo. Every default below is calibrated on in-repo fixtures
(`tests/sfsCalibrationScenarios.ts`) and stays the base profile until a report from real crawls exists.
A change to any value is a new profile version, never a silent edit. Past reports keep their profile id.

## Site Focus Score (#52)
| Setting | Default | Where |
| --- | --- | --- |
| TRS multiplier | 125 | `SFS_TRS_SCALE` in `src/services/siteFocus/profile.ts` |
| Bands | 90 / 75 / 60 / 40 | `SFS_BANDS` in the same file |
| Sensitivity sweep | 100 / 110 / 125 / 140 | `calibrate()` in `src/services/siteFocusCalibration` |
| Minimum sites for a trustworthy report | 3 scored sites | `sufficient` flag of the calibration report |

Why 125 stays: on the fixture corpus (niche, offer plus blog, shop, portal, polysemy; test
`tests/sfsCalibrationScenarios052.test.ts`) the off-topic count is identical at 100, 110, 125 and 140: 0 false
off-topic and 0 missed off-topic everywhere. The scale only moves pages between borderline and strong and shifts the
SFS by about 12 points between 100 and 140 (niche 55 / 60.5 / 68.8 / 77, shop 58.9 / 64.7 / 73.6 / 81.9).
At 110 almost all on-topic shop pages stay borderline, at 140 every borderline niche page becomes strong and the niche
site jumps into the good band. 125 is the middle value that separates the groups on every fixture. Fixtures are
synthetic: they show the direction of the effect, not the right number for your sites. Treat the bands as advisory.

### Re-calibrate on real crawls
1. Save 3 to 5 crawls (niche, offer plus blog, shop, multi-topic portal, polysemy) as JSON, with consent.
2. Write a `manifest.json` (format in the header of `tests/sfsCalibrationRun.test.ts`) with `provenance.consent: true`.
3. Run `SFS_CALIBRATION_MANIFEST=manifest.json npx vitest run tests/sfsCalibrationRun.test.ts`.
4. Read `test-results/sfs-calibration/sfs-calibration.md`: false off-topic, missed off-topic, histogram, sweep.
5. If a different scale or band wins on at least 3 sites, add a new profile version and a decision entry; do not edit the old one.

## URL protection (#81)
Defaults: TRS below 40, PRI below 0.15, PRI = max(clicks / (50 x 4), conversions / (1 x 2), domains / (5 x 3)).
Equality at 0.15 protects. Revenue above zero protects even outside PRI and needs a real currency.
Unknown, stale or partial 90 day data gives needs-data, never safe-delete. The app only advises:
no publish, delete, redirect or noindex is ever sent. Re-calibrate by exporting GSC/GA4/log evidence of kept and
pruned URLs and comparing the false-prune list; thresholds then ship as a new profile.

## Anchor pages and segments (#82 D01)
Site Core precedence: manual topic, business goal, anchors, detection. Each user-defined segment (URL prefix) is
scored against its own Core built from its own pages and reported as `split-subsites`; global anchors choose only the
site Core and never merge segments. Changing goal, anchors or brand list changes `coreConfigHash` and invalidates TAS, IGOS and EETV views.

## Template governor (#139)
Clusters by URL pattern plus DOM layout signature (depth capped, inline tags ignored, `template_signature.rs`).
Template Information Gain is measured on variables the crawler really extracted. noindex is advised only when
both the DOM skeleton and the variables were measured and the text is not a sample; otherwise the advice is `limit`
with a visible reason. Fixture proof: 500 local pages of one template give one template event.
Re-calibrate by crawling one real template segment and checking that the event count is 1 per template.

## Holistic score (#72 D01/D02)
IGOS and SIJA: mean of the latest measured per-phrase scores, at least 3, nulls skipped.
SPRS: share of pages neither under-linked nor leaking, at least 3 pages, converged graph only.
IGOS from another provider or model is excluded. Missing data leaves the module out of the renormalisation.
