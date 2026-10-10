import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SavedKeywordsFilterBar } from '@/components/Keywords/savedKeywords/SavedKeywordsFilterBar';

const t = ((key: string, options?: { count?: number }) => options?.count === undefined ? key : `${key}:${options.count}`) as never;

describe('SavedKeywordsFilterBar remaining branches', () => {
  it('updates text, selects a tag, toggles the same tag off, and clears to all', () => {
    const setSearchFilter = vi.fn();
    const setActiveTagFilter = vi.fn();
    const { rerender } = render(
      <SavedKeywordsFilterBar searchFilter="old" setSearchFilter={setSearchFilter} activeTagFilter={null} setActiveTagFilter={setActiveTagFilter} allTags={['priority', 'audit']} totalSavedKeywords={2} t={t} />,
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new' } });
    expect(setSearchFilter).toHaveBeenCalledWith('new');
    rerender(
      <SavedKeywordsFilterBar searchFilter="new" setSearchFilter={setSearchFilter} activeTagFilter="priority" setActiveTagFilter={setActiveTagFilter} allTags={['priority', 'audit']} totalSavedKeywords={2} t={t} />,
    );
    const priority = screen.getByRole('button', { name: 'priority' });
    expect(priority.className).toContain('bg-emerald');
    fireEvent.click(priority);
    expect(setActiveTagFilter).toHaveBeenCalledWith(null);
    fireEvent.click(screen.getByRole('button', { name: 'audit' }));
    expect(setActiveTagFilter).toHaveBeenCalledWith('audit');
    fireEvent.click(screen.getByRole('button', { name: 'savedKeywordsUi.all:2' }));
    expect(setActiveTagFilter).toHaveBeenCalledWith(null);
  });
});
