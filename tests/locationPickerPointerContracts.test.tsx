import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DataForSeoMarket } from '@/services/dataforseo';
import { DataForSeoLocationPicker } from '@/components/DataForSEO/pickers/DataForSeoLocationPicker';

const markets: DataForSeoMarket[] = [
  { code: 'US', label: 'United States', countryIsoCode: 'US', locationCode: 2840, locationType: 'Country', availableSources: 'google', languages: [{ code: 'en', label: 'English' }], catalogRows: [] },
  { code: 'PL', label: 'Poland', countryIsoCode: 'PL', locationCode: 2616, locationType: 'Country', availableSources: 'google', languages: [{ code: 'pl', label: 'Polish' }], catalogRows: [] },
];

describe('direct location picker pointer contracts', () => {
  it('commits an exact numeric provider location immediately', () => {
    const onChange = vi.fn();
    render(<DataForSeoLocationPicker value="US" markets={markets} onChange={onChange} ariaLabel="Location" />);
    const input = screen.getByRole('combobox', { name: 'Location' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '2616' } });
    expect(onChange).toHaveBeenCalledWith('2616');
    expect(screen.getByRole('option', { name: /Poland/ })).toBeTruthy();
  });

  it('updates the active option, keeps the menu open through press and closes outside', () => {
    const onChange = vi.fn();
    render(<DataForSeoLocationPicker value="US" markets={markets} onChange={onChange} ariaLabel="Location" />);
    const input = screen.getByRole('combobox', { name: 'Location' });
    fireEvent.focus(input);
    const option = screen.getByRole('option', { name: /Poland/ });
    fireEvent.mouseEnter(option);
    expect(input.getAttribute('aria-activedescendant')).toBe(option.id);
    fireEvent.mouseDown(option);
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.click(option);
    expect(onChange).toHaveBeenCalledWith('PL');
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.focus(input);
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('selects active option on Enter key press', () => {
    const onChange = vi.fn();
    render(<DataForSeoLocationPicker value="US" markets={markets} onChange={onChange} ariaLabel="Location" />);
    const input = screen.getByRole('combobox', { name: 'Location' });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalled();
  });
});
