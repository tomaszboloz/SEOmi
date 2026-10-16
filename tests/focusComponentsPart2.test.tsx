import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import i18n from '@/i18n';
import { buildSiteFocusReport } from '@/services/siteFocus';
import type { PageFocus } from '@/services/siteFocus';

import { CoreTopicPanel } from '@/components/Domain/crawlResults/focus/CoreTopicPanel';


import { FocusHeatmapTree } from '@/components/Domain/crawlResults/focus/FocusHeatmapTree';
import { FocusMetricsStrip } from '@/components/Domain/crawlResults/focus/FocusMetricsStrip';
import { KeywordAlignmentMatrix } from '@/components/Domain/crawlResults/focus/KeywordAlignmentMatrix';
import { PageFocusDetail } from '@/components/Domain/crawlResults/focus/PageFocusDetail';




import { diabetesSite } from './siteFocusFixtures';

const START = 'https://diabetes.test/';
const report = buildSiteFocusReport(diabetesSite(), START);
const worst = [...report.pages].filter((p) => !p.skipped).sort((a, b) => a.trs - b.trs)[0];


beforeEach(async () => {
  await i18n.changeLanguage('en');
});


describe('CoreTopicPanel', () => {
  const props = { coreTopic: { ...report.coreTopic, terms: [{ term: 'a', coveragePct: 0, weight: 1 }, ...report.coreTopic.terms] }, coveragePct: 61.5, confidence: 70, manualTopic: '', onManualTopicChange: vi.fn() };

  it('lists top 5 terms and coverage, toggles override input and resets', () => {
    const change = vi.fn();
    render(<CoreTopicPanel {...props} onManualTopicChange={change} />);
    expect(screen.getByTestId('focus-core-label').textContent).toBe(report.coreTopic.label);
    expect(screen.getAllByRole('img')).toHaveLength(5);
    expect(screen.getByText('Coverage: 61.5% of site content is closely related.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Is this the wrong topic?' }));
    fireEvent.change(screen.getByLabelText('Your topic (words or phrase)'), { target: { value: 'insulin' } });
    expect(change).toHaveBeenCalledWith('insulin');
    fireEvent.click(screen.getByRole('button', { name: 'Reset to detected topic' }));
    expect(change).toHaveBeenLastCalledWith('');
    expect(screen.getByRole('button', { name: 'Is this the wrong topic?' })).toBeTruthy();
  });

  it('stays open and shows the manual topic when set', () => {
    render(<CoreTopicPanel {...props} manualTopic="insulin" coreTopic={{ ...props.coreTopic, manualOverride: { input: 'insulin', matched: true } }} />);
    expect(screen.getByDisplayValue('insulin')).toBeTruthy();
    expect(screen.getByText('Manual topic: insulin')).toBeTruthy();
  });
});

describe('FocusMetricsStrip', () => {
  it('shows confidence, ratio and counts', () => {
    render(<FocusMetricsStrip report={report} />);
    expect(screen.getByText('Core Topic Confidence')).toBeTruthy();
    expect(screen.getByText(`${report.onTopicRatio}%`)).toBeTruthy();
    expect(screen.getByText('Pages skipped')).toBeTruthy();
  });
});

describe('FocusHeatmapTree', () => {
  const setup = (over: Partial<Parameters<typeof FocusHeatmapTree>[0]> = {}) => {
    const props = { pages: report.pages, filter: 'all' as const, onFilterChange: vi.fn(), ignoreTechnical: true, onIgnoreTechnicalChange: vi.fn(), selectedUrl: undefined, onSelect: vi.fn(), ...over };
    render(<FocusHeatmapTree {...props} />);
    return props;
  };

  it('renders rows with bars, warnings, sections and opens a page', () => {
    const props = setup({ selectedUrl: worst.url });
    expect(screen.getAllByRole('meter').length).toBeGreaterThan(3);
    expect(screen.getAllByRole('img', { name: 'Below 60: off-topic risk' }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Section /).length).toBeGreaterThan(0);
    expect(screen.getByText('Homepage')).toBeTruthy();
    const open = screen.getByRole('button', { name: `Open page analysis for ${worst.url}` });
    expect(open.getAttribute('aria-current')).toBe('true');
    fireEvent.click(open);
    expect(props.onSelect).toHaveBeenCalledWith(worst.url);
  });

  it('filters by relevance and toggles technical pages', () => {
    const props = setup({ filter: 'critical' });
    expect(screen.getByRole('button', { name: /^Critical <40/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /^Strong >=75/ }));
    expect(props.onFilterChange).toHaveBeenCalledWith('strong');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ignore technical pages' }));
    expect(props.onIgnoreTechnicalChange).toHaveBeenCalledWith(false);
  });

  it('shows an empty state and honours the technical toggle in counts', () => {
    render(<FocusHeatmapTree pages={report.pages.map((p) => ({ ...p, trs: 90 }))} filter="critical" onFilterChange={vi.fn()} ignoreTechnical={false} onIgnoreTechnicalChange={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByText('No pages match this filter.')).toBeTruthy();
  });
});

describe('KeywordAlignmentMatrix', () => {
  it('renders symbols for the three levels and an empty state', () => {
    const { rerender } = render(<KeywordAlignmentMatrix rows={[
      { term: 'a', freq: 3, relevancePct: 90, level: 'strong' },
      { term: 'b', freq: 2, relevancePct: 50, level: 'moderate' },
      { term: 'c', freq: 1, relevancePct: 5, level: 'weak' },
    ]} />);
    expect(screen.getByText('✓')).toBeTruthy();
    expect(screen.getByText('~')).toBeTruthy();
    expect(screen.getByText('✗')).toBeTruthy();
    expect(screen.getByLabelText('Does not match (below 40%)')).toBeTruthy();
    rerender(<KeywordAlignmentMatrix rows={[]} />);
    expect(screen.getByText('No keywords to show.')).toBeTruthy();
  });
});

describe('PageFocusDetail', () => {
  it('explains an off-topic page, shows playbook A and copies the AI prompt', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const onBack = vi.fn();
    const page: PageFocus = { ...worst, semanticDrift: 60, foreignClusters: [{ label: 'phones', sharePct: 60 }], offTopicKeywords: [{ term: 'battery', count: 4, cluster: 'phones' }], keywordsFound: [{ term: 'insulin', count: 2, context: '…use insulin daily…' }] };
    render(<PageFocusDetail page={page} report={report} onBack={onBack} />);
    expect(document.activeElement?.id).toBe('focus-detail-title');
    expect(screen.getByText('Red flag: more than half of the page is about other topics.')).toBeTruthy();
    expect(screen.getByText('Foreign topics: phones (60%)')).toBeTruthy();
    expect(screen.getAllByText('battery').length).toBeGreaterThan(0);
    expect(screen.getByText('Context: …use insulin daily…')).toBeTruthy();
    expect(screen.getByText(/Type A/)).toBeTruthy();
    expect(screen.getByTestId('focus-brief')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy AI prompt' })); });
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Rewrite the page'));
    expect(screen.getByText('Prompt copied')).toBeTruthy();
    writeText.mockRejectedValueOnce(new Error('no'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy AI prompt' })); });
    expect(screen.getByText(/Copy failed/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back to the list' }));
    expect(onBack).toHaveBeenCalled();
  });

});
