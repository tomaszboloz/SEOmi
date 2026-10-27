import type { PageFocus, PagePriority, PageStatus, Playbook, SfsBand } from './types';

export const ON_TOPIC_TRS = 60;
const round1 = (value: number): number => Math.round(value * 10) / 10;

export const bandFor = (score: number): SfsBand =>
  score >= 90 ? 'excellent' : score >= 75 ? 'good' : score >= 60 ? 'moderate' : score >= 40 ? 'weak' : 'critical';

export const statusFor = (trs: number): PageStatus =>
  trs >= 75 ? 'strong' : trs >= 60 ? 'moderate' : trs >= 50 ? 'borderline' : trs >= 40 ? 'weak' : 'off-topic';

export const priorityFor = (trs: number): PagePriority => (trs < 40 ? 'critical' : trs < 60 ? 'high' : trs < 75 ? 'medium' : 'low');

export const playbookFor = (trs: number): Playbook => (trs < 40 ? 'A' : trs < 75 ? 'B' : 'C');

type Scored = Pick<PageFocus, 'trs' | 'weight' | 'type' | 'skipped'>;

/** SFS = sum(w_i * TRS_i) / sum(w_i) over scored pages; On-topic Ratio counts non-technical pages with TRS >= 60. */
export const computeSfs = (pages: Scored[]): { score: number; onTopicRatio: number } => {
  const scored = pages.filter((page) => !page.skipped);
  const totalWeight = scored.reduce((sum, page) => sum + page.weight, 0);
  const content = scored.filter((page) => page.type !== 'technical');
  const basis = content.length ? content : scored;
  const score = totalWeight > 0 ? scored.reduce((sum, page) => sum + page.weight * page.trs, 0) / totalWeight : 0;
  const ratio = basis.length ? (basis.filter((page) => page.trs >= ON_TOPIC_TRS).length / basis.length) * 100 : 0;
  return { score: round1(Math.max(0, Math.min(100, score))), onTopicRatio: round1(ratio) };
};
