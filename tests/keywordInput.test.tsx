import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { KeywordInput } from '@/components/Keywords/keywordClustering/KeywordInput';
import type { ClusteringSession } from '@/components/Keywords/keywordClustering/keywordClusteringTypes';

const session = { input: 'a\nb', country: 'PL', language: 'pl', minSharedUrls: 3, result: null } as ClusteringSession;
const setup = (overrides: Record<string, unknown> = {}) => {
  const props = { session, isRunning: false, currentResearch: [{ keyword: 'research' }], savedKeywords: [{ keyword: 'saved' }], updateSession: vi.fn(), appendKeywords: vi.fn(), t: i18n.t, ...overrides };
  render(<KeywordInput {...(props as React.ComponentProps<typeof KeywordInput>)} />);
  return props;
};

it('reports edits and appends research or saved phrases', () => {
  const props = setup();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'x\ny' } });
  expect(props.updateSession).toHaveBeenCalledWith({ input: 'x\ny', result: null });
  fireEvent.click(screen.getByRole('button', { name: new RegExp(i18n.t('keywordClusteringUi.addFromResearch')) }));
  fireEvent.click(screen.getByRole('button', { name: new RegExp(i18n.t('keywordClusteringUi.addSaved')) }));
  expect(props.appendKeywords).toHaveBeenNthCalledWith(1, ['research']);
  expect(props.appendKeywords).toHaveBeenNthCalledWith(2, ['saved']);
});

it('disables adding when a source is empty and everything while running', () => {
  setup({ currentResearch: [], savedKeywords: [], isRunning: true });
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).disabled).toBe(true);
  for (const button of screen.getAllByRole('button')) expect((button as HTMLButtonElement).disabled).toBe(true);
});
