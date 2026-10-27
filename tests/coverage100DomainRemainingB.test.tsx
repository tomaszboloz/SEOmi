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
    const setLimit = vi.fn();
    const { unmount } = render(<CrawlLinksExternalCheck
      externalLinksCount={2} checkedExternalCount={2} blockedExternalCount={1} invalidExternalCount={1}
      uncheckedExternalCount={0} isCheckingExternalLinks={true}
      externalLinkCheckProgress={{ completed: 1, total: 2, currentUrl: 'https://ext.test/' }}
      externalLinkLimit={250} setExternalLinkLimit={setLimit} currentRun={{ id: 'run-1' } as never}
      checkExternalLinks={check} externalError="Check failed" t={((key: string) => key) as never}
    />);
    expect(screen.getByText('Check failed')).toBeTruthy();
    expect(screen.getByText(/https:\/\/ext\.test\//)).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '500' } });
    expect(setLimit).toHaveBeenCalledWith(500);
    unmount();
    render(<CrawlLinksExternalCheck
      externalLinksCount={2} checkedExternalCount={2} blockedExternalCount={0} invalidExternalCount={0}
      uncheckedExternalCount={0} isCheckingExternalLinks={false} externalLinkCheckProgress={null}
      externalLinkLimit={250} setExternalLinkLimit={setLimit} currentRun={{ id: 'run-1' } as never}
      checkExternalLinks={check} externalError={null} t={((key: string) => key) as never}
    />);
    fireEvent.click(screen.getByRole('button', { name: 'crawl.ui.checkExternalLinks' }));
    expect(check).toHaveBeenCalledWith('run-1', 250, true);
    const { container } = render(<CrawlLinksExternalCheck externalLinksCount={0} checkedExternalCount={0} blockedExternalCount={0} invalidExternalCount={0} uncheckedExternalCount={0} isCheckingExternalLinks={false} externalLinkCheckProgress={null} externalLinkLimit={100} setExternalLinkLimit={vi.fn()} checkExternalLinks={vi.fn()} externalError={null} t={((key: string) => key) as never} />);
    expect(container.firstChild).toBeNull();
  });

  it('evaluates the missing unlabeled-control total without inventing a count', () => {
    const view = render(<MetadataAccessibilityFindings audit={{ url: 'https://site.test/' } as never} />);
    expect(view.container.firstChild).toBeNull();
    view.unmount();
    render(<MetadataAccessibilityFindings audit={{
      url: 'https://site.test/', final_url: 'https://site.test/final',
      accessibility: {
        unlabeled_form_control_count: 5,
        findings: [
          {
            code: 'accessibility-form-controls-unlabeled', severity: 'warning', message: 'Missing label',
            evidence: 'input', recommendation: 'Add a label', elements: [{ dom_position: 1, dom_query: 'input', html_snippet: '<input>' }],
          },
          {
            code: 'accessibility-image-alt-missing', severity: 'error', message: 'Missing alt',
            evidence: 'img', recommendation: 'Add alt', elements: [{ dom_position: 2, dom_query: 'img', html_snippet: '<img>', line: 10, column: 2 }],
          },
          {
            code: 'accessibility-duplicate-id', severity: 'info', message: 'Duplicate ID',
            evidence: '#id', recommendation: 'Fix ID', elements: Array.from({ length: 50 }, (_, i) => ({ dom_position: i + 1, dom_query: `#id-${i}`, html_snippet: `<div id="id-${i}">` })),
          },
        ],
      },
    } as never} />);
    expect(screen.getByText(i18n.t('accessibility.shownCount', { shown: 1, total: 5 }))).toBeTruthy();
    expect(screen.getByText(i18n.t('accessibility.shownMax'))).toBeTruthy();
  });
});
