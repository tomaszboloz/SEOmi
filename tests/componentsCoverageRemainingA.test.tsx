import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SemanticAuditPanel } from '@/components/Charts/SemanticAuditPanel';
import { BriefVersionHistory } from '@/components/Charts/contentBrief/BriefVersionHistory';
import { BriefParagraphs } from '@/components/Charts/contentBrief/BriefParagraphs';

const semantic = vi.hoisted(() => ({ build: vi.fn(), compare: vi.fn(), guard: vi.fn(), monitor: vi.fn() }));
const brief = vi.hoisted(() => ({ save: vi.fn(), diff: vi.fn(), match: vi.fn() }));
vi.mock('react-i18next', async (importOriginal) => ({ ...(await importOriginal<typeof import('react-i18next')>()), useTranslation: () => ({ t: (key: string, values?: Record<string, unknown>) => values ? `${key}:${JSON.stringify(values)}` : key }) }));
vi.mock('@/services/semanticAudit', () => ({ buildSemanticAudit: semantic.build }));
vi.mock('@/services/semanticRunComparison', () => ({ compareSemanticRuns: semantic.compare }));
vi.mock('@/services/crawlComparisonContract', () => ({ guardCrawlComparison: semantic.guard }));
vi.mock('@/services/monitoringAlerts', () => ({ monitorSemanticComparison: semantic.monitor }));
vi.mock('@/services/contentBrief', () => ({ saveDraftVersion: brief.save, compareDrafts: brief.diff, matchParagraphToCrawlSource: brief.match, isHttpSourceUrl: () => true, updateParagraphReview: () => [] }));

const emptyReport = { mappedTopics: 0, totalTopics: 0, mappedPages: 0, totalPages: 0, contentOrphanPages: 0, truncated: false, entityObservability: [], findings: [] };
const counts = Object.fromEntries(['url-added', 'url-not-observed', 'content-terms-changed', 'content-link-added', 'content-link-not-observed', 'topic-edge-added', 'topic-edge-not-observed', 'topic-url-coverage-changed', 'query-term-observation-changed'].map((key) => [key, 0]));
const comparison = { baselineRunId: 'baseline', currentRunId: 'current', truncated: false, counts, changes: [] };

describe('remaining component branch contracts', () => {
  beforeEach(() => {
    semantic.build.mockReturnValue(emptyReport);
    semantic.compare.mockReturnValue(comparison);
    semantic.guard.mockReturnValue(null);
    semantic.monitor.mockReset();
    brief.save.mockReset();
    brief.diff.mockReturnValue({ changed: false, addedLineCount: 0, removedLineCount: 0, addedCharacterCount: 0, removedCharacterCount: 0, addedLines: [], removedLines: [] });
  });

  it('keeps a malformed baseline id empty and passes an absent comparison guard through', () => {
    const baseline = { id: undefined, completedAt: '2026-09-01', result: { pages_crawled: 0, pages: [] } };
    const current = { id: 'current', completedAt: '2026-09-02', result: { pages_crawled: 1, pages: [] } };
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<SemanticAuditPanel document={{} as never} pages={[]} runs={[baseline, current] as never} currentRunId="current" />);
    expect(semantic.compare).toHaveBeenCalledWith(expect.anything(), baseline, expect.objectContaining({ id: 'current' }), { guard: undefined });
    consoleError.mockRestore();
  });

  it('uses the empty selected-version fallback and ignores a same-draft restore', () => {
    const onUpdate = vi.fn();
    const model = { brief: { draftMarkdown: 'draft', draftVersions: [] }, onUpdate };
    brief.save.mockImplementation((value: typeof model.brief) => ({ ...value, draftVersions: [] }));
    render(<BriefVersionHistory model={model as never} />);
    fireEvent.change(screen.getByLabelText('contentBrief.versionNoteAria'), { target: { value: 'note' } });
    fireEvent.click(screen.getByRole('button', { name: 'contentBrief.saveVersion' }));
    expect(onUpdate).toHaveBeenCalledOnce();

    const same = { brief: { draftMarkdown: 'same', draftVersions: [{ id: 'v1', draftMarkdown: 'same', note: '', savedAt: '2026-09-01' }] }, onUpdate: vi.fn() };
    const view = render(<BriefVersionHistory model={same as never} />);
    fireEvent.change(screen.getByLabelText('contentBrief.diffAria'), { target: { value: 'v1' } });
    const restore = screen.getByRole('button', { name: 'contentBrief.restoreVersion' });
    restore.removeAttribute('disabled');
    fireEvent.click(restore);
    expect(same.onUpdate).not.toHaveBeenCalled();
    view.unmount();
  });

  it('renders a matched source evidence record without an overlap percentage', () => {
    brief.match.mockReturnValue({ matched: true, scope: 'shared-terms', matchedTerms: ['seo'], overlapPercent: null, responseSpan: null });
    const model = { brief: { draftMarkdown: 'paragraph', paragraphReviews: [{ paragraph: 'paragraph', treatment: 'source-backed', sourceUrl: 'https://source.test', sourceChecked: false }] }, pages: [], paragraphs: ['paragraph'], assessment: { unsupportedParagraphs: [], unreviewedParagraphs: [] }, update: vi.fn() };
    render(<BriefParagraphs model={model as never} />);
    expect(screen.getByText(/contentBrief\.snapshotExcerpt/)).toBeTruthy();
    expect(screen.queryByText(/%/)).toBeNull();
  });
});
