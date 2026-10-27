import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { SemanticAuditPanel } from '@/components/Charts/SemanticAuditPanel';
import { ScheduledAuditsPanel } from '@/components/Domain/ScheduledAuditsPanel';
import { AioPassageCard } from '@/components/Domain/crawlResults/aio/AioPassageCard';
import { comparisonDocument, comparisonPage } from './fixtures/semanticComparison';
import { createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';

const { rewriteMock, addMock, syncMock } = vi.hoisted(() => ({
  rewriteMock: vi.fn(),
  addMock: vi.fn(),
  syncMock: vi.fn(),
}));

vi.mock('@/services/aioReadiness', async (original) => ({
  ...(await original<typeof import('@/services/aioReadiness')>()),
  rewritePassage: rewriteMock,
}));

vi.mock('@/services/scheduleWakeup', () => ({
  syncAuditWakeup: syncMock,
  removeAuditWakeup: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/auditSchedule', async (orig) => {
  const actual = await orig<typeof import('@/services/auditSchedule')>();
  addMock.mockImplementation(actual.addScheduledAudit);
  return { ...actual, addScheduledAudit: addMock };
});

vi.mock('@/components/Results/copilotPatcher', () => ({
  CopilotPatcherPanel: () => <div data-testid="patcher" />,
  pageHasPatchContext: () => false,
  patchTargetForPassage: () => ({}),
}));

beforeEach(async () => {
  await i18n.changeLanguage('en');
  Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {}, configurable: true });
  rewriteMock.mockReset();
  addMock.mockReset();
  syncMock.mockReset().mockResolvedValue(undefined);
});

describe('geminiGapNATIVESecondary: SemanticAuditPanel, ScheduledAuditsPanel, AioPassageCard', () => {
  it('covers SemanticAuditPanel baseline comparison and fallback (line 43)', () => {
    const document = comparisonDocument();
    const current = comparisonPage('https://site.test/coffee', ['coffee']);
    const baseline = createCrawlRunFixture({
      id: 'baseline-run',
      projectId: 'p1',
      completedAt: '2026-10-01',
      result: createCrawlResultFixture({ pages: [], pages_crawled: 0 }),
    });
    const currentRun = createCrawlRunFixture({
      id: 'run-custom',
      projectId: 'p1',
      completedAt: '2026-10-02',
      result: createCrawlResultFixture({ pages: [current], pages_crawled: 1 }),
    });

    const view1 = render(
      <SemanticAuditPanel
        document={document}
        pages={[current]}
        runs={[baseline, currentRun]}
        currentRunId="run-custom"
      />,
    );
    expect(screen.getByLabelText(i18n.t('semanticAudit.baselineRunAria'))).toBeTruthy();
    view1.unmount();

    const view2 = render(
      <SemanticAuditPanel
        document={document}
        pages={[current]}
        runs={[baseline, currentRun]}
        currentRunId={undefined}
      />,
    );
    expect(screen.queryByTestId('semantic-comparison-guard')).toBeNull();
    view2.unmount();

    render(
      <SemanticAuditPanel
        document={document}
        pages={[current]}
        runs={[baseline, { ...currentRun, id: 'current-snapshot' }]}
        currentRunId="current-snapshot"
      />,
    );
    expect(screen.getByLabelText(i18n.t('semanticAudit.baselineRunAria'))).toBeTruthy();
  });

  it('covers ScheduledAuditsPanel error branches (line 129)', async () => {
    addMock.mockImplementationOnce(() => {
      throw new Error('Custom scheduler failure');
    });

    render(<ScheduledAuditsPanel projectId="proj-err" initialUrl="https://example.com" />);
    fireEvent.click(screen.getByText(i18n.t('schedules.title')));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('schedules.add') }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Custom scheduler failure');

    addMock.mockImplementationOnce(() => {
      throw 'string-error';
    });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('schedules.add') }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(i18n.t('schedules.saveError'));
    });
  });

  it('covers AioPassageCard copy and clipboard handling (line 25)', async () => {
    const clipboard = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: clipboard }, configurable: true });

    const passage = {
      url: 'https://site.test/p',
      heading: '',
      windowIndex: 0,
      tokens: 15,
      score: 30,
      issues: [],
      text: 'Original unoptimized text',
    };

    rewriteMock.mockResolvedValueOnce({ status: 'ok', text: 'Optimized rewrite text' });
    render(<AioPassageCard passage={passage as never} index={0} />);

    expect(screen.getByText(i18n.t('aio.passage.noHeading'), { exact: false })).toBeTruthy();

    const generateBtn = screen.getByRole('button', { name: /Rewrite with AI/i });
    fireEvent.click(generateBtn);

    const copyBtn = await screen.findByRole('button', { name: i18n.t('aio.passage.copy') });
    fireEvent.click(copyBtn);
    await waitFor(() => expect(clipboard).toHaveBeenCalledWith('Optimized rewrite text'));

    clipboard.mockRejectedValueOnce(new Error('Clipboard denied'));
    fireEvent.click(copyBtn);
  });
});
