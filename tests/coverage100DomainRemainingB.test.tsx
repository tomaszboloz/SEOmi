import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { AioPassageCard } from '@/components/Domain/crawlResults/aio/AioPassageCard';
import { CrawlLinksExternalCheck } from '@/components/Domain/crawlResults/linksTab/CrawlLinksExternalCheck';
import { MetadataAccessibilityFindings } from '@/components/Results/metadata/MetadataAccessibilityFindings';

const rewrite = vi.hoisted(() => vi.fn());
vi.mock('@/services/aioReadiness', async (original) => ({ ...(await original<typeof import('@/services/aioReadiness')>()), rewritePassage: rewrite }));
vi.mock('@/components/Results/copilotPatcher', () => ({
  CopilotPatcherPanel: () => <div data-testid="patcher" />,
  pageHasPatchContext: (page: unknown) => Boolean(page),
  patchTargetForPassage: () => ({}),
}));
vi.mock('@/components/Results/ShowOnPageButton', () => ({ ShowOnPageButton: () => <i data-testid="show" /> }));

beforeEach(async () => { await i18n.changeLanguage('en'); rewrite.mockReset(); });

describe('coverage100 domain remaining B', () => {
  it('shows unavailable patch context for an unassociated AIO passage', () => {
    render(<AioPassageCard passage={{ url: 'https://site.test/p', heading: 'H', windowIndex: 0, tokens: 4, score: 10, issues: [], text: 'text' } as never} index={0} />);
    expect(screen.getByRole('status').textContent).toContain(i18n.t('copilotPatcherUi.contextUnavailable'));
  });

  it('runs an external check when the current run exists', () => {
    const check = vi.fn().mockResolvedValue(undefined);
    render(<CrawlLinksExternalCheck
      externalLinksCount={2} checkedExternalCount={2} blockedExternalCount={0} invalidExternalCount={0}
      uncheckedExternalCount={0} isCheckingExternalLinks={false} externalLinkCheckProgress={null}
      externalLinkLimit={250} setExternalLinkLimit={vi.fn()} currentRun={{ id: 'run-1' } as never}
      checkExternalLinks={check} externalError={null} t={((key: string) => key) as never}
    />);
    fireEvent.click(screen.getByRole('button', { name: 'crawl.ui.checkExternalLinks' }));
    expect(check).toHaveBeenCalledWith('run-1', 250, true);
  });

  it('evaluates the missing unlabeled-control total without inventing a count', () => {
    render(<MetadataAccessibilityFindings audit={{
      url: 'https://site.test/', final_url: '',
      accessibility: { findings: [{
        code: 'accessibility-form-controls-unlabeled', severity: 'warning', message: 'Missing label',
        evidence: 'input', recommendation: 'Add a label', elements: [{ dom_position: 1, dom_query: 'input', html_snippet: '<input>' }],
      }] },
    } as never} />);
    expect(screen.getByText(i18n.t('accessibility.elementCount', { count: 1 }))).toBeTruthy();
    expect(screen.queryByText(/shownCount/)).toBeNull();
  });
});
