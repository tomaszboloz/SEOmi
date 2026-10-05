import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { TFunction } from 'i18next';
import { SavedKeywordsTableRow } from '@/components/Keywords/savedKeywords/SavedKeywordsTableRow';
import { keyword } from './fixtures/savedKeywordsSession';

afterEach(cleanup);
const t = ((key: string) => key) as TFunction;
function setup(difficulty = 20, editing = false) {
  const actions = { setNewTagInput: vi.fn(), onAddTag: vi.fn(), onRemoveTag: vi.fn(), onDeleteKeyword: vi.fn() };
  const item = keyword('row', { difficulty, tags: ['priority', 'keep'] });
  render(<table><tbody><SavedKeywordsTableRow item={item} newTagInput={editing ? { id: 'row', tag: 'draft' } : null}
    {...actions} intentLabel={intent => `intent:${intent}`} t={t} /></tbody></table>);
  return { actions, item };
}

it('starts editing, removes a specific tag and deletes the exact row', () => {
  const { actions } = setup();
  fireEvent.click(screen.getByRole('button', { name: '+ savedKeywordsUi.tag' }));
  expect(actions.setNewTagInput).toHaveBeenCalledExactlyOnceWith({ id: 'row', tag: '' });
  fireEvent.click(screen.getAllByTitle('savedKeywordsUi.removeTag')[1]);
  expect(actions.onRemoveTag).toHaveBeenCalledExactlyOnceWith('row', 'keep');
  fireEvent.click(screen.getByTitle('savedKeywordsUi.deleteKeyword'));
  expect(actions.onDeleteKeyword).toHaveBeenCalledExactlyOnceWith('row');
  expect(screen.getByText('intent:Commercial')).toBeTruthy();
  expect(screen.getByText('$2.00')).toBeTruthy();
});

it('routes edited text and Enter, Escape and confirmation actions to the exact row', () => {
  const { actions } = setup(20, true);
  const input = screen.getByRole('textbox');
  expect((input as HTMLInputElement).value).toBe('draft');
  fireEvent.change(input, { target: { value: 'new' } });
  expect(actions.setNewTagInput).toHaveBeenCalledWith({ id: 'row', tag: 'new' });
  fireEvent.keyDown(input, { key: 'x' });
  expect(actions.onAddTag).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(actions.onAddTag).toHaveBeenCalledExactlyOnceWith('row');
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(actions.setNewTagInput).toHaveBeenLastCalledWith(null);
  fireEvent.click(screen.getByRole('button', { name: '✓' }));
  expect(actions.onAddTag).toHaveBeenNthCalledWith(2, 'row');
});

it.each([[29, 'emerald'], [30, 'amber'], [59, 'amber'], [60, 'rose']])('renders difficulty boundary %s as %s', (value, color) => {
  setup(Number(value));
  expect(screen.getByText(String(value)).className).toContain(`text-${color}-400`);
});
