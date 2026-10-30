import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { calibrate, crawlInput, parseCalibrationManifest, renderCalibrationMarkdown, type CalibrationSite } from '@/services/siteFocusCalibration';

/**
 * Site Focus calibration runner (#52). Opt-in: it reads persisted, consented crawls listed in a manifest
 * and writes a Markdown + JSON report. Nothing here ships results; without a manifest the test is skipped.
 *
 *   SFS_CALIBRATION_MANIFEST=path/to/manifest.json [SFS_CALIBRATION_OUT=dir] npx vitest run tests/sfsCalibrationRun.test.ts
 *
 * Manifest: { "sites": [{ "id", "kind": niche|offer-blog|ecommerce|multi-topic|polysemy|other, "file": "crawl.json",
 *   "provenance": { "source", "consent": true, "crawledAt" }, "labels"?: { "<url>": "on-topic"|"borderline"|"off-topic" },
 *   "options"?: { manualTopic, anchorUrls, businessGoal, language, brand } }], "scales"?: [100, 125] }
 */
const manifestPath = process.env.SFS_CALIBRATION_MANIFEST;

describe('Site Focus calibration runner (#52)', () => {
  it.skipIf(!manifestPath)('scores the manifest corpus and writes a reproducible report', () => {
    const path = resolve(manifestPath as string);
    const manifest = parseCalibrationManifest(JSON.parse(readFileSync(path, 'utf8')));
    const sites: CalibrationSite[] = manifest.sites.map((entry) => {
      const bytes = readFileSync(resolve(dirname(path), entry.file));
      const { startUrl, pages } = crawlInput(JSON.parse(bytes.toString('utf8')));
      return { ...entry, startUrl, pages, inputSha256: createHash('sha256').update(bytes).digest('hex') };
    });
    const report = calibrate(sites, { scales: manifest.scales });
    const out = resolve(process.env.SFS_CALIBRATION_OUT ?? 'test-results/sfs-calibration');
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'sfs-calibration.json'), `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(join(out, 'sfs-calibration.md'), renderCalibrationMarkdown(report));
    expect(report.sites.length + report.rejected.length).toBe(manifest.sites.length);
  });
});
