import { buildSiteFocusReport, sfsProfileRef } from '@/services/siteFocus';
import { labelMatrix, scaleOutcome, trsHistogram } from './metrics';
import { CALIBRATION_KINDS, type CalibrationReport, type CalibrationSite, type SiteCalibration } from './types';

/** TRS multipliers compared in every report; 125 is the current profile (GEM-52-D01). */
export const DEFAULT_SCALES = [100, 110, 125, 140];
export const MIN_SITES = 3;

const rejection = (site: CalibrationSite): CalibrationReport['rejected'][number]['reason'] | null => {
  if (site.provenance?.consent !== true) return 'no-consent';
  if (!site.provenance.source?.trim()) return 'no-source';
  return site.pages.length ? null : 'no-pages';
};

const calibrateSite = (site: CalibrationSite, scales: number[], now: string): SiteCalibration => {
  const report = buildSiteFocusReport(site.pages, site.startUrl, { ...site.options, now });
  const live = report.pages.filter((page) => !page.skipped);
  const none = report.unavailable === true;
  return {
    id: site.id,
    kind: site.kind,
    inputSha256: site.inputSha256 ?? null,
    pageCount: report.pageCount,
    scored: live.length,
    skipped: report.pages.length - live.length,
    partial: live.filter((page) => page.degraded).length,
    unavailable: none,
    sfs: none ? null : report.score,
    band: none ? null : report.band,
    confidence: none ? null : report.confidence,
    onTopicRatio: none ? null : report.onTopicRatio,
    fallbackMode: report.flags.fallbackMode,
    coreTopic: { label: report.coreTopic.label, mode: report.coreTopic.mode ?? 'auto' },
    trsHistogram: trsHistogram(report.pages),
    scales: scales.map((scale) => scaleOutcome(report.pages, report.flags.fallbackMode, scale)),
    labels: labelMatrix(report.pages, site.labels),
  };
};

/**
 * Reproducible Site Focus calibration over persisted, consented crawls (#52). It only measures:
 * distributions, multiplier sensitivity and agreement with manual labels. It never changes the
 * profile; a threshold change needs a reviewed decision and a new profile version (#83).
 */
export const calibrate = (sites: CalibrationSite[], options: { scales?: number[]; now?: string } = {}): CalibrationReport => {
  const scales = options.scales?.length ? options.scales : DEFAULT_SCALES;
  const now = options.now ?? new Date().toISOString();
  const rejected: CalibrationReport['rejected'] = [];
  const accepted = sites.filter((site) => {
    const reason = rejection(site);
    if (reason) rejected.push({ id: site.id, reason });
    return !reason;
  });
  const results = accepted.map((site) => calibrateSite(site, scales, now));
  const kinds = new Set(results.map((site) => site.kind));
  return {
    profile: sfsProfileRef(),
    generatedAt: now,
    scales,
    sites: results,
    rejected,
    missingKinds: CALIBRATION_KINDS.filter((kind) => !kinds.has(kind)),
    sufficient: results.filter((site) => !site.unavailable).length >= MIN_SITES,
  };
};
