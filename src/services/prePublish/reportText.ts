import type { TFunction } from 'i18next';
import type { PrePublishReport } from './check';

const signed = (delta: number): string => `${delta > 0 ? '+' : ''}${delta}`;

/** Plain-text before/after card for copying. Same wording as the panel; nothing is published. */
export const prePublishReportText = (report: PrePublishReport, t: TFunction): string => [
  t('prePublishUi.title'),
  t(`prePublishUi.verdict.${report.verdict}`),
  ...(report.sfsDelta === null ? [] : [t('prePublishUi.sfs', { before: report.sfsBefore, after: report.sfsAfter, delta: signed(report.sfsDelta), trs: report.draftTrs })]),
  ...report.reasons.map((reason) => `- ${t(`prePublishUi.reason.${reason}`)}`),
  ...report.conflicts.map((conflict) => `- ${t(`prePublishUi.${conflict.level}`, { url: conflict.url, value: (conflict.similarity * 100).toFixed(1) })}`),
  ...report.chunkIssues.map((issue) => `- ${t(`prePublishUi.chunk.${issue.kind}`, { index: issue.index + 1 })}`),
  ...(report.policy && report.gate ? [t(`prePublishUi.gate.${report.gate}`, { policy: t(`prePublishUi.policy.${report.policy}`) })] : []),
  ...(report.evidenceGaps ?? []).map((gap) => `- ${t(`prePublishUi.gap.${gap}`)}`),
  ...(report.donors ?? []).map((donor) => `- ${t('prePublishUi.donors.row', { url: donor.url, similarity: (donor.similarity * 100).toFixed(1), trs: donor.trs })}`),
].join('\n');
