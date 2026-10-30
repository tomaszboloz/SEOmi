import { afterEach, describe, expect, it } from 'vitest';
import { buildSiteFocusReport, checkBusinessGoal, type FocusPage } from '@/services/siteFocus';
import { summarizeSiteFocus } from '@/services/export/focusSummary';
import { focusGoalKey, projectFocusOptions, readBusinessGoal, writeBusinessGoal } from '@/services/siteFocusMonitoring';
import { DIABETES_TERMS, PHONE_TERMS, makePage } from './siteFocusFixtures';

const HOST = 'offer.test';
const START = `https://${HOST}/`;
const OFFER = ['smartphone repair', 'battery replacement', 'screen repair', 'charging port', 'warranty', 'service'];
const rotate = (pool: string[], start: number, size: number): Array<[string, number]> =>
  Array.from({ length: size }, (_, j): [string, number] => [pool[(start + j) % pool.length], 3 + ((start + j) % 3)]);

/** Small offer drowned by a 30-article diabetes blog (GEM-82-T01). */
const pages = (): FocusPage[] => [
  makePage(HOST, { path: '/', title: 'Phone repair service', terms: [...rotate(OFFER, 0, 6), ...rotate(PHONE_TERMS, 0, 4)] }),
  ...[0, 1, 2].map((i) => makePage(HOST, { path: `/offer/service-${i}`, title: `Service ${i}`, terms: [...rotate(OFFER, i, 5), ...rotate(PHONE_TERMS, i * 3, 5)] })),
  ...Array.from({ length: 30 }, (_, i) => makePage(HOST, { path: `/blog/post-${i}`, title: `Post ${i}`, terms: rotate(DIABETES_TERMS, i, 14) })),
];
const build = (businessGoal?: string, manualTopic?: string, anchorUrls?: string[]) =>
  buildSiteFocusReport(pages(), START, { businessGoal, manualTopic, anchorUrls, language: 'en', now: '2026-10-27T00:00:00Z' });
const termsOf = (report: ReturnType<typeof build>) => report.coreTopic.terms.map((term) => term.term).join(' ');

afterEach(() => localStorage.clear());

describe('business goal validation (#82)', () => {
  it('accepts a sentence and rejects short, long, URL-like and word-less input', () => {
    expect(checkBusinessGoal('  sell   smartphone repair ')).toEqual({ ok: true, value: 'sell smartphone repair' });
    expect(checkBusinessGoal('ab')).toEqual({ ok: false, error: 'too-short' });
    expect(checkBusinessGoal('a'.repeat(201))).toEqual({ ok: false, error: 'too-long' });
    expect(checkBusinessGoal('https://offer.test/x')).toEqual({ ok: false, error: 'looks-like-url' });
    expect(checkBusinessGoal('123 456 !!')).toEqual({ ok: false, error: 'no-words' });
    expect(checkBusinessGoal(42)).toEqual({ ok: false, error: 'too-short' });
    expect(checkBusinessGoal('naprawa telefonów').ok).toBe(true);
  });
});

describe('business goal picks the Core Topic (GEM-82-T01/T02)', () => {
  it('a matched goal keeps the offer as Core Topic over a large blog', () => {
    expect(termsOf(build())).toMatch(/insulin|glucose|diabetes/);
    const report = build('smartphone repair and battery replacement');
    expect(report.coreTopic.mode).toBe('goal');
    expect(report.coreTopic.businessGoal).toEqual({ input: 'smartphone repair and battery replacement', matched: true, applied: true });
    expect(termsOf(report)).toMatch(/repair|battery|smartphone/);
  });

  it('an unmatched goal is reported and never invented into a topic', () => {
    const report = build('sell yachts in monaco');
    expect(report.coreTopic.mode).toBe('auto');
    expect(report.coreTopic.businessGoal).toEqual({ input: 'sell yachts in monaco', matched: false, applied: false });
    expect(termsOf(report)).not.toMatch(/yacht|monaco/);
    expect(build('sell yachts in monaco', undefined, [`https://${HOST}/offer/service-0`]).coreTopic.mode).toBe('anchored');
  });

  it('a manual topic wins over the goal; the goal wins over anchors; an invalid goal is ignored', () => {
    const manual = build('smartphone repair', 'insulin');
    expect(manual.coreTopic.mode).toBe('manual');
    expect(manual.coreTopic.businessGoal).toMatchObject({ matched: true, applied: false });
    expect(build('insulin glucose', undefined, [`https://${HOST}/offer/service-0`]).coreTopic.mode).toBe('goal');
    expect(build('https://offer.test/').coreTopic).not.toHaveProperty('businessGoal');
  });

  it('the PDF summary states the goal and whether it decided the topic', () => {
    expect(summarizeSiteFocus(build('smartphone repair')).core_topic).toMatchObject({ mode: 'goal', business_goal: 'smartphone repair', goal_matched: true, goal_applied: true });
    expect(summarizeSiteFocus(build()).core_topic).not.toHaveProperty('business_goal');
  });
});

describe('per-project goal storage (GEM-82-06 partial)', () => {
  it('saves valid goals, rejects invalid ones without overwriting, clears on empty', () => {
    expect(writeBusinessGoal('p1', 'sell smartphone repair')).toEqual({ ok: true, value: 'sell smartphone repair' });
    expect(writeBusinessGoal('p1', 'x')).toEqual({ ok: false, error: 'too-short' });
    expect(readBusinessGoal('p1')).toBe('sell smartphone repair');
    expect(projectFocusOptions('p1').businessGoal).toBe('sell smartphone repair');
    expect(readBusinessGoal('p2')).toBeUndefined();
    expect(writeBusinessGoal('p1', '  ')).toEqual({ ok: true, value: '' });
    expect(readBusinessGoal('p1')).toBeUndefined();
    expect(projectFocusOptions('p1')).not.toHaveProperty('businessGoal');
  });

  it('a stored value that no longer validates reads as no goal', () => {
    localStorage.setItem(focusGoalKey('p1'), JSON.stringify('!'));
    expect(readBusinessGoal('p1')).toBeUndefined();
    expect(readBusinessGoal(null)).toBeUndefined();
  });
});
