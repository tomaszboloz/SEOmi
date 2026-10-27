import { describe, expect, it } from 'vitest';
import { buildSiteFocusReport, evaluateAlerts, makeSnapshot, type PageFocus } from '@/services/siteFocus';
import { buildRecommendations } from '@/services/siteFocus/recommend';
import { focusAlertEvents } from '@/services/monitoringAlerts/focus';
import { manualKeys } from '@/services/siteFocus/coreTopic';
import { semanticTermKey } from '@/services/semanticText';
import { diabetesSite } from './siteFocusFixtures';

const flags = { isLowConfidence: false, isMultiTopic: false, skippedRenderTimeouts: 0 } as never;
const page = (url: string, trs: number): PageFocus => ({ url, trs, weight: 1, type: 'article', skipped: false, keywordsFound: [] } as unknown as PageFocus);

describe('#79 weak pages (TRS 40-59) get advice', () => {
  const codes = (trs: number) => buildRecommendations([page('https://a.test/x', trs)], 50, flags, [], 0, []).map((rec) => rec.code);
  it.each([[39.99, false], [40, true], [49.9, true], [59.99, true], [74.99, true], [75, false]])('TRS %s', (trs, expected) => {
    expect(codes(trs).includes('strengthen-borderline')).toBe(expected);
  });
});

describe('#80 no scored pages is unavailable, not a critical 0', () => {
  const startUrl = 'https://diabetes.test/';
  it('flags an empty crawl and keeps real zero scores measured', () => {
    const empty = buildSiteFocusReport([], startUrl, { now: '2026-10-15T00:00:00Z' });
    expect(empty.unavailable).toBe(true);
    const measured = buildSiteFocusReport(diabetesSite(), startUrl, { now: '2026-10-15T00:00:00Z' });
    expect(measured.unavailable).toBeUndefined();
    expect(makeSnapshot(empty, 'r1').unavailable).toBe(true);
    expect('unavailable' in makeSnapshot(measured, 'r2')).toBe(false);
  });

  it('raises no drop alert from or to an unavailable snapshot', () => {
    const base = makeSnapshot(buildSiteFocusReport(diabetesSite(), startUrl, { now: '2026-10-15T00:00:00Z' }), 'a');
    const gone = { ...base, runId: 'b', score: 0, unavailable: true };
    expect(evaluateAlerts(base, gone)).toEqual([]);
    expect(evaluateAlerts(gone, { ...base, score: 1 })).toEqual([]);
    expect(focusAlertEvents(base, gone)).toEqual([]);
    expect(focusAlertEvents(base, { ...base, score: 0 }).map((event) => event.code)).toContain('sfs-drop');
  });
});

describe('#123 typed topics without diacritics match accented terms', () => {
  it.each([['pl', 'zolc', 'Żółć'], ['es', 'nino', 'Niño'], ['de', 'groesse', 'Größe']])('%s', (lang, typed, accented) => {
    const typedKey = manualKeys(typed, lang)[0];
    expect(typedKey).toBe(semanticTermKey(accented, lang));
  });
});
