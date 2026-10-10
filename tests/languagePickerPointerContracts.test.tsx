import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DataForSeoLanguagePicker } from '@/components/DataForSEO/pickers/DataForSeoLanguagePicker';
import { dataForSeoMarket } from '@/services/dataforseo';

describe('direct language picker pointer selection', () => {
  it('moves the active option on hover, prevents blur on press and commits only the clicked code', () => {
    const change = vi.fn();
    render(<DataForSeoLanguagePicker value="de" market={dataForSeoMarket('CH')} onChange={change} ariaLabel="Language" />);
    const input = screen.getByRole('combobox', { name: 'Language' }) as HTMLInputElement;
    fireEvent.focus(input);
    const options = screen.getAllByRole('option');
    const target = options.find((option) => option.textContent?.includes('(it)'))!;
    fireEvent.mouseEnter(target);
    expect(input.getAttribute('aria-activedescendant')).toBe(target.id);
    expect(fireEvent.mouseDown(target)).toBe(false);
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(target);
    expect(change.mock.calls).toEqual([['it']]);
    expect(input.value).toContain('(it)');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('listbox')).toBeNull();
  });
  it('retains unknown language input without inventing a selected code and ignores no matches', () => {
    const change = vi.fn();
    render(<DataForSeoLanguagePicker value="obsolete" market={dataForSeoMarket('CH')} onChange={change} ariaLabel="Unknown language" />);
    const input = screen.getByRole('combobox', { name: 'Unknown language' }) as HTMLInputElement;
    expect(input.value).toBe('');
    fireEvent.change(input, { target: { value: 'impossible-language' } });
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);
    expect(change).not.toHaveBeenCalled();
    expect(input.value).toBe('impossible-language');
  });

  it('closes dropdown on click outside', () => {
    render(<DataForSeoLanguagePicker value="de" market={dataForSeoMarket('CH')} onChange={vi.fn()} ariaLabel="Language" />);
    const input = screen.getByRole('combobox', { name: 'Language' });
    fireEvent.focus(input);
    expect(screen.getByRole('listbox')).toBeDefined();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
