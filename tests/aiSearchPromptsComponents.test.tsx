import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AiSearchPromptsHeader } from '@/components/AiVisibility/searchPrompts/AiSearchPromptsHeader';
import { AiSearchPromptForm } from '@/components/AiVisibility/searchPrompts/AiSearchPromptForm';
import { AiSearchHistoryAndContext } from '@/components/AiVisibility/searchPrompts/AiSearchHistoryAndContext';
import { AiSearchResultCard } from '@/components/AiVisibility/searchPrompts/AiSearchResultCard';
import { AiSearchPrompts } from '@/components/AiVisibility/AiSearchPrompts';
import { useToolsStore } from '@/stores/toolsStore';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

const mockT = ((key: string, opts?: any) => {
  if (opts && typeof opts.prompt !== 'undefined') return `${key}:${opts.prompt}`;
  return key;
}) as any;

describe('AiSearchPrompts modular architecture', () => {
  it('satisfies physical LOC <= 150 across AiSearchPrompts and submodules', () => {
    const files = [
      'src/components/AiVisibility/AiSearchPrompts.tsx',
      ...codeFiles('src/components/AiVisibility/searchPrompts'),
    ];
    expect(files.length).toBe(9);
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('renders AiSearchPromptsHeader', () => {
    render(<AiSearchPromptsHeader t={mockT} />);
    expect(screen.getByText('aiVisibility.search.title')).toBeTruthy();
    expect(screen.getByText('aiVisibility.search.localOnly')).toBeTruthy();
  });

  it('renders AiSearchPromptForm and handles input & samples', () => {
    const onChangePrompt = vi.fn();
    const onSubmit = vi.fn();
    const onSelectSample = vi.fn();

    render(
      <AiSearchPromptForm
        prompt="who is seomi"
        isLoading={false}
        samplePrompts={['sample 1', 'sample 2']}
        onChangePrompt={onChangePrompt}
        onSubmit={onSubmit}
        onSelectSample={onSelectSample}
        t={mockT}
      />,
    );

    const input = screen.getByRole('textbox', { name: /aiVisibility.search.promptLabel/i });
    expect(input).toBeTruthy();
    fireEvent.change(input, { target: { value: 'top seo audit tool' } });
    expect(onChangePrompt).toHaveBeenCalledWith('top seo audit tool');

    fireEvent.click(screen.getByText('sample 1'));
    expect(onSelectSample).toHaveBeenCalledWith('sample 1');
  });

  it('renders AiSearchHistoryAndContext with snapshot selections', () => {
    const onSelectHistory = vi.fn();
    const onSelectSourceContextRun = vi.fn();
    const mockComparison: any = {
      prompt: 'what is seomi',
      captured_at: '2026-02-01T12:00:00Z',
      results: [],
    };
    render(
      <AiSearchHistoryAndContext
        comparison={mockComparison}
        history={[mockComparison]}
        onSelectHistory={onSelectHistory}
        crawlRuns={[]}
        sourceContextRunId=""
        sourceContextRun={null}
        sourceContextSaveError={false}
        onSelectSourceContextRun={onSelectSourceContextRun}
        t={mockT}
      />,
    );
    expect(screen.getByText('aiVisibility.search.sourceTitle')).toBeTruthy();
  });

  it('renders AiSearchResultCard with output and citations', () => {
    const onCopy = vi.fn();
    const mockResult: any = {
      model_name: 'gpt-4o',
      provider: 'openai',
      captured_at: '2026-02-01T12:00:00Z',
      response_text: 'SEOmi is a fast desktop SEO auditor.',
      response_status: 'ok',
      search_mode: 'web_search',
      brand_mentions: ['SEOmi'],
      citations: ['https://seomi.org/overview'],
    };
    render(
      <AiSearchResultCard
        result={mockResult}
        idx={0}
        copiedIdx={null}
        onCopy={onCopy}
        summary={{ total: 1, matched: 1, contextual: 1, sentenceMatches: 1 }}
        evidenceList={[{ citation: 'https://seomi.org/overview', normalizedUrl: 'https://seomi.org/overview', matched: true } as any]}
        sourceContextRun={null}
        t={mockT}
      />,
    );
    expect(screen.getByText('gpt-4o')).toBeTruthy();
    expect(screen.getByText('SEOmi is a fast desktop SEO auditor.')).toBeTruthy();
    expect(screen.getByText('https://seomi.org/overview')).toBeTruthy();
  });

  it('renders AiSearchPrompts with error state and sample selection', () => {
    const runPrompt = vi.fn();
    useToolsStore.setState({
      aiPromptError: 'Sample AI prompt error',
      runAiPromptComparison: runPrompt,
    });
    render(<AiSearchPrompts />);
    expect(screen.getByText('Sample AI prompt error')).toBeTruthy();

    const sampleBtn = screen.getByText(/What are the top open-source SEO/i);
    fireEvent.click(sampleBtn);
    expect(runPrompt).toHaveBeenCalledWith(expect.stringContaining('open-source SEO'));
  });
});
