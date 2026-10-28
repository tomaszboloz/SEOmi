import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import en from '@/i18n/locales/en.json';
import { annotateChange, buildSiteFocusReport, makeSnapshot, playbookFor, statusFor, trsGroup, type PageFocus, type SiteFocusReport } from '@/services/siteFocus';
import { buildRecommendations } from '@/services/siteFocus/recommend';
import { summarizeSiteFocus } from '@/services/export/focusSummary';
import { matchesFilter } from '@/components/Domain/crawlResults/focus/focusHelpers';
import { FocusMetricsStrip } from '@/components/Domain/crawlResults/focus/FocusMetricsStrip';
import { diabetesSite } from './siteFocusFixtures';

const flags = { isLowConfidence: false, isMultiTopic: false, skippedRenderTimeouts: 0 } as never;
const page = (trs: number, url = 'https://a.test/x'): PageFocus => ({ url, trs, weight: 1, type: 'article', skipped: false, keywordsFound: [] } as unknown as PageFocus);

// [trs, group, status, playbook]
const TABLE: Array<[number, string, string, string]> = [
  [39.99, 'off-topic', 'off-topic', 'A'], [40, 'borderline', 'weak', 'B'],
  [49.99, 'borderline', 'weak', 'B'], [50, 'borderline', 'borderline', 'B'],
  [59.99, 'borderline', 'borderline', 'B'], [60, 'borderline', 'moderate', 'B'],
  [74.99, 'borderline', 'moderate', 'B'], [75, 'strong', 'strong', 'C'],
  [89.99, 'strong', 'strong', 'C'], [90, 'strong', 'strong', 'C'],
];

beforeAll(async () => { await i18n.changeLanguage('en'); });

describe('#79 one TRS policy for engine, UI and PDF', () => {
  it.each(TABLE)('TRS %s is group %s / status %s / playbook %s', (trs, group, status, playbook) => {
    expect(trsGroup(trs)).toBe(group);
    expect(statusFor(trs)).toBe(status);
    expect(playbookFor(trs)).toBe(playbook);
    const borderline = group === 'borderline';
    const codes = buildRecommendations([page(trs)], 50, flags, [], 0, []).map((rec) => rec.code);
    expect(codes.includes('strengthen-borderline')).toBe(borderline);
    expect(codes.includes('remove-offtopic')).toBe(group === 'off-topic');
    expect(matchesFilter(page(trs), 'borderline')).toBe(borderline);
    expect(matchesFilter(page(trs), 'critical')).toBe(group === 'off-topic');
    expect(matchesFilter(page(trs), 'strong')).toBe(group === 'strong');
  });

  it('PDF summary and metric card count the same 40-74 pages as the recommendation', () => {
    const base = buildSiteFocusReport(diabetesSite(), 'https://diabetes.test/', { now: '2026-10-15T00:00:00Z' });
    const pages = TABLE.map(([trs], i) => ({ ...page(trs, `https://a.test/${i}`), status: statusFor(trs) }));
    const report = { ...base, pages } as SiteFocusReport;
    const counts = summarizeSiteFocus(report).counts;
    expect(counts).toMatchObject({ off_topic: 1, borderline: 6, strong: 3 });
    const rec = buildRecommendations(pages, 50, flags, [], 0, []).find((item) => item.code === 'strengthen-borderline');
    expect(rec?.params.count).toBe(counts.borderline);
    render(<FocusMetricsStrip report={report} />);
    expect(screen.getByText(en.focus.metrics.borderline).closest('div')?.textContent).toContain('6');
    expect(en.focus.metrics.borderline).toContain('40-74');
    expect(en.focus.heatmap.filter.borderline).toContain('40-74');
    expect(en.pdfReport.crawl.focus.nBorderline).toContain('40-74');
  });

  it('history credits optimized pages across the whole 40-74 group', () => {
    const before = makeSnapshot({ ...buildSiteFocusReport(diabetesSite(), 'https://diabetes.test/'), pages: [page(45, 'https://a.test/w')] } as SiteFocusReport, 'r1');
    const after = { ...before, runId: 'r2', pages: { 'https://a.test/w': { trs: 80, weight: 1, type: 'article' as const } } };
    expect(annotateChange(before, after).map((note) => note.code)).toContain('optimized-borderline');
  });
});
