import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { FocusHistoryChart } from '@/components/Domain/crawlResults/focus/FocusHistoryChart';
import { summarizeSiteFocus } from '@/services/export/focusSummary';
import { annotateChange, buildSiteFocusReport, makeSnapshot, type SfsSnapshot } from '@/services/siteFocus';
import { diabetesSite } from './siteFocusFixtures';

const HOST = 'diabetes.test';
const START = `https://${HOST}/`;
const NOW = '2026-10-01T00:00:00Z';
const report = (anchorUrls?: string[]) => buildSiteFocusReport(diabetesSite(HOST), START, { anchorUrls, now: NOW });
const category = `${START}category/diabetes-care`;

afterEach(async () => { cleanup(); await i18n.changeLanguage('en'); });

describe('core topic provenance', () => {
  it('records the selection mode and applied anchor count in history snapshots', () => {
    expect(makeSnapshot(report(), 'r1').coreTopic).toEqual(expect.objectContaining({ mode: 'auto' }));
    expect(makeSnapshot(report(), 'r1').coreTopic).not.toHaveProperty('anchorCount');
    const anchored = makeSnapshot(report([category]), 'r2').coreTopic;
    expect(anchored).toEqual(expect.objectContaining({ mode: 'anchored', anchorCount: 2 }));
  });

  it('annotates a changed selection mode, but not against legacy snapshots without one', () => {
    const before = makeSnapshot(report(), 'r1');
    const after = makeSnapshot(report([category]), 'r2');
    expect(annotateChange(before, after)).toContainEqual(expect.objectContaining({ code: 'core-mode-changed', params: { from: 'auto', to: 'anchored' } }));
    const legacy: SfsSnapshot = { ...before, coreTopic: { label: before.coreTopic.label, clusterId: before.coreTopic.clusterId } };
    expect(annotateChange(legacy, after).map((note) => note.code)).not.toContain('core-mode-changed');
    expect(annotateChange(before, before).map((note) => note.code)).not.toContain('core-mode-changed');
  });

  it('passes mode and anchor counts to the PDF summary', () => {
    expect(summarizeSiteFocus(report()).core_topic).toEqual(expect.objectContaining({ mode: 'auto' }));
    expect(summarizeSiteFocus(report()).core_topic).not.toHaveProperty('anchor_source_count');
    const core = summarizeSiteFocus(report([category, `${START}missing`])).core_topic;
    expect(core).toEqual(expect.objectContaining({ mode: 'anchored', anchor_source_count: 2, anchor_missing_count: 1 }));
  });

  it('shows the mode change in the reader language on the history chart', async () => {
    const point = (runId: string, score: number) => ({ runId, at: '2026-01-01T00:00:00Z', score, pageCount: 5, delta: null });
    const series = {
      points: [point('a', 60), point('b', 70)],
      markers: [{ runId: 'b', at: '2026-01-02T00:00:00Z', score: 70, code: 'core-mode-changed' as const, params: { from: 'auto', to: 'anchored' }, delta: 10 }],
    };
    render(<FocusHistoryChart series={series} />);
    expect(screen.getByText('Topic selection changed from detection from all content to home and anchor pages (+10 points).')).toBeTruthy();
    cleanup();
    await i18n.changeLanguage('pl');
    render(<FocusHistoryChart series={series} />);
    expect(screen.getByText('Sposób wyboru tematu zmienił się: wykrywanie z całej treści → strona główna i kotwice (+10 pkt).')).toBeTruthy();
  });
});
