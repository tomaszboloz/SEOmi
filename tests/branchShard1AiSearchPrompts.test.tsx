import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AiSearchPrompts } from '@/components/AiVisibility/AiSearchPrompts';

const session = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('@/components/AiVisibility/searchPrompts/useAiSearchPromptsSession', () => ({
  useAiSearchPromptsSession: () => session.value,
}));

describe('AiSearchPrompts result cards', () => {
  it('renders a result card with no citation evidence when the evidence list is shorter than the results', () => {
    session.value = {
      aiSearchPrompt: 'q', setAiSearchPrompt: vi.fn(), isLoading: false, error: null, runAiPromptComparison: vi.fn(),
      selectAiPromptComparison: vi.fn(), aiPromptHistory: [], crawlRuns: [], sourceContextRunId: '', selectSourceContextRun: vi.fn(),
      sourceContextSaveError: false, sourceContextRun: null, citationsWithEvidence: [], citationSummaries: [], copiedIdx: null,
      handleCopy: vi.fn(), handleCompare: vi.fn(), samplePrompts: [], t: (key: string) => key,
      aiPromptComparison: {
        prompt: 'q', captured_at: '2026-02-01T12:00:00Z',
        results: [{
          model_name: 'model-x', provider: 'openai', captured_at: '2026-02-01T12:00:00Z', response_text: 'Answer text.',
          response_status: 'ok', search_mode: 'web_search', brand_mentions: [], citations: ['https://example.test/source'],
        }],
      },
    };
    render(<AiSearchPrompts />);
    expect(screen.getByText('model-x')).toBeTruthy();
    expect(screen.getByText('Answer text.')).toBeTruthy();
  });
});
