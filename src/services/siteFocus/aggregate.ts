import { SFS_BANDS } from './profile';
import { OFF_TOPIC_BELOW, ON_TOPIC_FROM, STRONG_FROM, trsGroup } from './trsPolicy';
import type { PageFocus, PagePriority, PageStatus, Playbook, SfsBand } from './types';

export const ON_TOPIC_TRS = ON_TOPIC_FROM;
const round1 = (value: number): number => Math.round(value * 10) / 10;

export const bandFor = (score: number): SfsBand =>
  score >= SFS_BANDS.excellent ? 'excellent' : score >= SFS_BANDS.good ? 'good' : score >= SFS_BANDS.moderate ? 'moderate'
    : score >= SFS_BANDS.weak ? 'weak' : 'critical';

/** Status subdivides the TRS groups in ./trsPolicy: 'weak', 'borderline' and 'moderate' are all in the borderline group (40-74). */
export const statusFor = (trs: number): PageStatus =>
  trs >= STRONG_FROM ? 'strong' : trs >= ON_TOPIC_FROM ? 'moderate' : trs >= 50 ? 'borderline' : trs >= OFF_TOPIC_BELOW ? 'weak' : 'off-topic';

export const priorityFor = (trs: number): PagePriority => (trs < 40 ? 'critical' : trs < 60 ? 'high' : trs < 75 ? 'medium' : 'low');

const PLAYBOOK: Record<ReturnType<typeof trsGroup>, Playbook> = { 'off-topic': 'A', borderline: 'B', strong: 'C' };
export const playbookFor = (trs: number): Playbook => PLAYBOOK[trsGroup(trs)];

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
