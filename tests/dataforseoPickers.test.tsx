import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DataForSeoLanguagePicker, DataForSeoLocationPicker } from '../src/components/DataForSEO/DataForSeoPickers';
import { DATAFORSEO_MARKETS, dataForSeoMarket } from '../src/services/dataforseo';

describe('DataForSEO searchable pickers', () => {
  it('filters locations by typed prefix and orders prefix matches first', () => {
    render(<DataForSeoLocationPicker value="US" onChange={vi.fn()} ariaLabel="Location" />);
    const input = screen.getByRole('combobox', { name: 'Location' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'uni' } });
    const options = screen.getAllByRole('option').map((option) => option.textContent || '');
    expect(options[0]).toContain('United');
    expect(options).toEqual(expect.arrayContaining([
      expect.stringContaining('United Kingdom (GB)'),
      expect.stringContaining('United States (US)'),
    ]));
    expect(options).not.toEqual(expect.arrayContaining([expect.stringContaining('Poland (PL)')]));
    expect(input.getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[0].id);

    fireEvent.keyDown(input, { key: 'End' });
    const lastOption = screen.getAllByRole('option').at(-1);
    expect(input.getAttribute('aria-activedescendant')).toBe(lastOption?.id);

    fireEvent.keyDown(input, { key: 'Home' });
    expect(input.getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[0].id);
  });

  it('keeps numeric provider locations searchable and ranks an exact location first', () => {
    render(<DataForSeoLocationPicker value="US" onChange={vi.fn()} ariaLabel="Location" />);
    const input = screen.getByRole('combobox', { name: 'Location' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '2840' } });
    const options = screen.getAllByRole('option').map((option) => option.textContent || '');
    expect(options[0]).toContain('2840');
    expect(options).toHaveLength(1);
  });

  it('supports keyboard selection and exposes every language for a location', () => {
    const onChange = vi.fn();
    render(<DataForSeoLanguagePicker value="en" market={dataForSeoMarket('CH')} onChange={onChange} ariaLabel="Language" />);
    const input = screen.getByRole('combobox', { name: 'Language' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'ita' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('it');
    expect(DATAFORSEO_MARKETS.find((market) => market.code === 'CH')?.languages.map((item) => item.code)).toEqual(expect.arrayContaining(['de', 'fr', 'it']));
  });
});


describe('paid market selection safeguards', () => {
  it('restores the selected location after free-text filtering without submitting that text', () => {
    const change = vi.fn();
    render(<DataForSeoLocationPicker value="US" onChange={change} ariaLabel="Paid location" />);
    const input = screen.getByRole('combobox', { name: 'Paid location' }) as HTMLInputElement;
    const previous = input.value;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Poland (PL)' } });
    fireEvent.blur(input);
    expect(input.value).toBe(previous);
    expect(change).not.toHaveBeenCalled();
  });

  it('commits a location only when its catalogue option is selected', () => {
    const change = vi.fn();
    render(<DataForSeoLocationPicker value="US" onChange={change} ariaLabel="Picked location" />);
    const input = screen.getByRole('combobox', { name: 'Picked location' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Poland' } });
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('option', { name: /Poland/ }));
    expect(change.mock.calls).toEqual([['PL']]);
  });

  it('does not replace an unknown location with the US or submit an empty match', () => {
    const change = vi.fn();
    render(<DataForSeoLocationPicker value="obsolete-market" onChange={change} ariaLabel="Unknown location" />);
    const input = screen.getByRole('combobox', { name: 'Unknown location' }) as HTMLInputElement;
    expect(input.value).toBe('');
    fireEvent.change(input, { target: { value: 'no-such-market' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(change).not.toHaveBeenCalled();
  });

  it('restores the selected language after free-text filtering', () => {
    const change = vi.fn();
    render(<DataForSeoLanguagePicker value="de" market={dataForSeoMarket('CH')} onChange={change} ariaLabel="Paid language" />);
    const input = screen.getByRole('combobox', { name: 'Paid language' }) as HTMLInputElement;
    const previous = input.value;
    fireEvent.change(input, { target: { value: 'Italian' } });
    fireEvent.blur(input);
    expect(input.value).toBe(previous);
    expect(change).not.toHaveBeenCalled();
  });

  it('disables language selection when no validated market is available', () => {
    render(<DataForSeoLanguagePicker value="en" onChange={vi.fn()} ariaLabel="Unavailable language" />);
    expect((screen.getByRole('combobox', { name: 'Unavailable language' }) as HTMLInputElement).disabled).toBe(true);
  });
});
