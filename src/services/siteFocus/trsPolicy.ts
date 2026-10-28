/**
 * Single page-level TRS policy (#79). Page TRS groups are separate from the domain SFS bands in `bandFor`.
 *
 * | TRS      | group       | page status          | site-wide advice        |
 * |----------|-------------|----------------------|-------------------------|
 * | 0-39.99  | off-topic   | off-topic            | remove-offtopic         |
 * | 40-74.99 | borderline  | weak/borderline/moderate | strengthen-borderline |
 * | 75-100   | strong      | strong               | none                    |
 *
 * UI filters, metric cards, the PDF summary and history annotations all read the group from here.
 */
export const OFF_TOPIC_BELOW = 40;
export const ON_TOPIC_FROM = 60;
export const STRONG_FROM = 75;

export type TrsGroup = 'off-topic' | 'borderline' | 'strong';

export const trsGroup = (trs: number): TrsGroup =>
  trs < OFF_TOPIC_BELOW ? 'off-topic' : trs < STRONG_FROM ? 'borderline' : 'strong';

export const isBorderlineTrs = (trs: number): boolean => trsGroup(trs) === 'borderline';
