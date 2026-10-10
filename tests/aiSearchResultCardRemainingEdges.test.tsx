import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import i18n from '@/i18n';
import type { AiPromptComparisonResult } from '@/types';
import { AiSearchResultCard } from '@/components/AiVisibility/searchPrompts/AiSearchResultCard';

const result: AiPromptComparisonResult = {
  model_name: 'gpt-test', response_text: 'Saved answer', brand_mentions: [], citations: [], provider: 'openai',
  connection_method: 'local_cli', captured_at: '2026-10-01T10:00:00Z', response_status: 'success',
  search_mode: 'model_knowledge', mention_position: null, own_domain_cited: false,
};
const show = (patch: Partial<AiPromptComparisonResult> = {}, copiedIdx: number | null = null) => render(
  <AiSearchResultCard result={{ ...result, ...patch }} idx={2} copiedIdx={copiedIdx} onCopy={vi.fn()}
    summary={undefined} evidenceList={[]} sourceContextRun={null} t={i18n.t} />,
);
afterEach(cleanup);

describe('AI search result card remaining branches', () => {
  it('shows copied state and positive domain citation', () => {
    const onCopy = vi.fn();
    const view = render(<AiSearchResultCard result={{ ...result, brand_mentions: ['SEOmi'], own_domain_cited: true }} idx={2}
      copiedIdx={2} onCopy={onCopy} summary={undefined} evidenceList={[]} sourceContextRun={null} t={i18n.t} />);
    const button = screen.getByRole('button', { name: i18n.t('aiVisibility.search.copyResponse') });
    fireEvent.click(button);
    expect(button.querySelector('svg')).toBeTruthy();
    expect(onCopy).toHaveBeenCalledWith('Saved answer', 2);
    view.unmount();
  });

  it('renders recorded provider errors instead of response text', () => {
    show({ response_status: 'error', error_message: 'Provider unavailable', search_mode: undefined });
    expect(screen.getByText(i18n.t('aiVisibility.search.noResponse', { message: 'Provider unavailable' }))).toBeTruthy();
    expect(screen.queryByText('Saved answer')).toBeNull();
  });
});
