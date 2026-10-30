import type { CalibrationReport, SiteCalibration } from './types';

const show = (value: number | string | null | undefined): string => (value === null || value === undefined || value === '' ? '—' : String(value));
const cell = (value: string): string => value.replace(/\|/g, '\\|').replace(/\s+/g, ' ');

const siteRow = (site: SiteCalibration): string => [
  site.id, site.kind, show(site.inputSha256?.slice(0, 12)), String(site.pageCount), String(site.scored), String(site.skipped), String(site.partial),
  show(site.sfs), show(site.band), show(site.confidence), show(site.onTopicRatio), site.fallbackMode, cell(site.coreTopic.label || '—'),
].map(cell).join(' | ');

const scaleRows = (site: SiteCalibration): string[] => site.scales.map((outcome) =>
  `| ${site.id} | ${outcome.scale} | ${show(outcome.sfs)} | ${show(outcome.band)} | ${outcome.groups['off-topic']} | ${outcome.groups.borderline} | ${outcome.groups.strong} |`);

const labelRows = (site: SiteCalibration): string[] => {
  const labels = site.labels;
  if (!labels) return [`- ${site.id}: no manual labels.`];
  const m = labels.matrix;
  return [
    `- ${site.id}: ${labels.labelled} labelled, agreement ${show(labels.agreementPct)}%.`,
    `  on-topic → off/borderline/strong: ${m['on-topic']['off-topic']}/${m['on-topic'].borderline}/${m['on-topic'].strong};`
      + ` borderline: ${m.borderline['off-topic']}/${m.borderline.borderline}/${m.borderline.strong};`
      + ` off-topic: ${m['off-topic']['off-topic']}/${m['off-topic'].borderline}/${m['off-topic'].strong}.`,
    `  Labelled on-topic but scored off-topic: ${labels.falseOffTopic.length ? labels.falseOffTopic.join(', ') : 'none'}.`,
    `  Labelled off-topic but scored strong: ${labels.missedOffTopic.length ? labels.missedOffTopic.join(', ') : 'none'}.`,
    ...(labels.unmatchedLabels.length ? [`  Labels without a scored page: ${labels.unmatchedLabels.join(', ')}.`] : []),
  ];
};

/** Plain Markdown calibration report; every number comes from the measured corpus, unknown is a dash. */
export const renderCalibrationMarkdown = (report: CalibrationReport): string => [
  '# Site Focus calibration report',
  '',
  `Profile: ${report.profile.id} ${report.profile.algorithmVersion} (config ${report.profile.configHash}). Generated ${report.generatedAt}.`,
  report.sufficient
    ? 'Corpus size meets the minimum of 3 scored, consented sites. Any threshold change still needs a reviewed decision and a new profile version.'
    : 'Insufficient corpus: fewer than 3 scored, consented sites. Do not change thresholds or the TRS multiplier from this report.',
  `Missing corpus kinds: ${report.missingKinds.length ? report.missingKinds.join(', ') : 'none'}.`,
  ...(report.rejected.length ? [`Rejected inputs: ${report.rejected.map((item) => `${item.id} (${item.reason})`).join(', ')}.`] : []),
  '',
  '## Sites',
  '',
  '| Site | Kind | Input SHA-256 | Pages | Scored | Skipped | Partial | SFS | Band | Confidence | On-topic % | Mode | Core topic |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ...report.sites.map((site) => `| ${siteRow(site)} |`),
  '',
  '## TRS distribution (content pages per 10-point bucket)',
  '',
  ...report.sites.map((site) => `- ${site.id}: ${site.trsHistogram.join(' / ')}`),
  '',
  `## TRS multiplier sensitivity (${report.scales.join(', ')})`,
  '',
  '| Site | Multiplier | SFS | Band | Off-topic | Borderline | Strong |',
  '|---|---|---|---|---|---|---|',
  ...report.sites.flatMap(scaleRows),
  '',
  '## Manual labels',
  '',
  ...report.sites.flatMap(labelRows),
  '',
].join('\n');
