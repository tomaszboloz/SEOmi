import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FreeSuggestionsPanel } from '@/components/KeywordResearch/freeSuggestions/FreeSuggestionsPanel';
import { McpServerConfigCard } from '@/components/AgentWorkflows/mcpHub/McpServerConfigCard';
import { CrawlDirectoryTree } from '@/components/Charts/CrawlDirectoryTree';
import { CrawlOverviewTab } from '@/components/Domain/crawlResults/CrawlOverviewTab';
import { CrawlLinksExternalCheck } from '@/components/Domain/crawlResults/linksTab/CrawlLinksExternalCheck';

const m = vi.hoisted(() => ({ importSuggestions: vi.fn(), add: vi.fn(), save: vi.fn(), session: { inputQuery: 'seo', setInputQuery: vi.fn(), fetching: false, error: null, result: null, fetchSuggestions: vi.fn(), saveSuggestion: vi.fn(), isSaved: () => false } }));
vi.mock('react-i18next', async (importOriginal) => ({ ...(await importOriginal<typeof import('react-i18next')>()), useTranslation: () => ({ t: (key: string, values?: Record<string, unknown>) => values ? `${key}:${JSON.stringify(values)}` : key }) }));
vi.mock('@/stores/projectStore', () => ({ useProjectStore: (select: (state: { activeProjectId: string }) => unknown) => select({ activeProjectId: 'project' }) }));
vi.mock('@/stores/toolsStore', () => ({ useToolsStore: (select: (state: unknown) => unknown) => select({ savedKeywords: [], crawlRuns: [], addSavedKeyword: m.add }) }));
vi.mock('@/components/KeywordResearch/freeSuggestions/useFreeSuggestionsSession', () => ({ useFreeSuggestionsSession: () => m.session }));
vi.mock('@/services/freeSuggestions', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/services/freeSuggestions')>()), importSuggestions: m.importSuggestions }));
vi.mock('@/services/clipboard', () => ({ copyText: vi.fn() }));
vi.mock('@/services/tauri', () => ({ saveTextFile: m.save, isTauriEnvironment: () => true }));
vi.mock('@/services/crawlDirectoryTree', () => ({ filterCrawlPagesForDirectoryTree: (pages: unknown[]) => pages, buildCrawlDirectoryTree: () => ({ roots: [{ id: 'root', name: '', depth: 0, ownPages: [{ url: 'https://site.test/', title: '', http_status: 200, issues: [], word_count: 0, response_time_ms: 0 }], childDirectories: [], metrics: { pageCount: 1, status2xx: 1, status4xx: 0, status5xx: 0, requestErrors: 0, criticalIssues: 0, warningIssues: 0, indexable: 0, words: 0, averageResponseMs: 0 } }], pageCount: 1, ignoredPageCount: 0, metrics: { pageCount: 1, status2xx: 1, status4xx: 0, status5xx: 0, requestErrors: 0, criticalIssues: 0, warningIssues: 0, indexable: 0, words: 0, averageResponseMs: 0 } }) }));
vi.mock('@/components/Domain/crawlResults/CrawlSummaryMetrics', () => ({ CrawlSummaryMetrics: () => <tr><td>summary</td></tr> }));

describe('remaining component branches', () => {
  it('imports and saves a unique suggestion', () => {
    m.add.mockReset();
    m.importSuggestions.mockReturnValue({ suggestions: ['seo unique'], importedAt: 'now', source: { kind: 'user-import', sourceUrl: 'https://source.test/' } });
    render(<FreeSuggestionsPanel query="seo" geo="PL" language="pl" />);
    fireEvent.change(screen.getByRole('textbox', { name: 'googleSuggestionsUi.importPayload' }), { target: { value: '["seo unique"]' } });
    fireEvent.click(screen.getByRole('button', { name: 'googleSuggestionsUi.import' }));
    fireEvent.click(screen.getByRole('button', { name: 'googleSuggestionsUi.save' }));
    expect(m.add).toHaveBeenCalledWith(expect.objectContaining({ keyword: 'seo unique', tags: ['User import'] }));
  });

  it('guards export when the MCP server path is invalid', () => {
    render(<McpServerConfigCard mcpClientTab="claude" setMcpClientTab={vi.fn()} serverPath="relative.js" updateServerPath={vi.fn()} discoverTools={vi.fn()} discovering={false} discoveryError="" />);
    const button = screen.getByRole('button', { name: 'mcp.exportConfig' });
    button.removeAttribute('disabled');
    fireEvent.click(button);
    expect(m.save).not.toHaveBeenCalled();
  });

  it('falls back to a slash when directory data has no page or node label', () => {
    render(<CrawlDirectoryTree pages={[]} projectId={null} runId="run" />);
    expect(screen.getByTitle('https://site.test/').textContent).toContain('/');
  });

  it('keeps an absent rejected URL list at zero', () => {
    const t = (key: string) => key;
    render(<CrawlOverviewTab session={{ result: { rejected_urls: undefined }, t } as never} />);
    expect(screen.queryByText(/siteAudit\.rejectedUrls/)).toBeNull();
  });

  it('does nothing when external checking has no current run', () => {
    const check = vi.fn();
    render(<CrawlLinksExternalCheck externalLinksCount={1} checkedExternalCount={0} blockedExternalCount={0} invalidExternalCount={0} uncheckedExternalCount={0} isCheckingExternalLinks={false} externalLinkCheckProgress={null} externalLinkLimit={100} setExternalLinkLimit={vi.fn()} checkExternalLinks={check} externalError={null} t={((key: string) => key) as never} />);
    const button = screen.getByRole('button', { name: 'crawl.ui.checkExternalLinks' });
    button.removeAttribute('disabled');
    fireEvent.click(button);
    expect(check).not.toHaveBeenCalled();
  });
});
