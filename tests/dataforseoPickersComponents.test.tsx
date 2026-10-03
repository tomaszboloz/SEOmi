import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  normalize,
  pickerSort,
} from '@/components/DataForSEO/pickers/pickerPrimitives';
import { DataForSeoLocationPicker } from '@/components/DataForSEO/pickers/DataForSeoLocationPicker';
import { DataForSeoLanguagePicker } from '@/components/DataForSEO/pickers/DataForSeoLanguagePicker';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

describe('DataForSeoPickers modular architecture', () => {
  it('satisfies physical LOC <= 150 across DataForSeoPickers and pickers submodules', () => {
    const files = [
      'src/components/DataForSEO/DataForSeoPickers.tsx',
      ...codeFiles('src/components/DataForSEO/pickers'),
    ];
    expect(files.length).toBe(7);
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('normalizes strings and sorts candidates by exact and prefix match', () => {
    expect(normalize('  Pólska  ')).toBe('polska');

    const exactLeft = pickerSort('poland', ['Poland', 'PL'], ['Germany', 'DE']);
    expect(exactLeft).toBeLessThan(0);

    const prefixLeft = pickerSort('pol', ['Poland', 'PL'], ['Germany', 'DE']);
    expect(prefixLeft).toBeLessThan(0);
  });

  it('renders DataForSeoLocationPicker and handles option selection', () => {
    const onChange = vi.fn();
    const mockMarkets = [
      {
        code: 'US',
        label: 'United States',
        locationCode: 2840,
        languages: [{ code: 'en', label: 'English' }],
      },
      {
        code: 'PL',
        label: 'Poland',
        locationCode: 2616,
        languages: [{ code: 'pl', label: 'Polish' }],
      },
    ];

    render(
      <DataForSeoLocationPicker
        value="US"
        onChange={onChange}
        markets={mockMarkets as any}
        ariaLabel="Location Picker"
      />,
    );

    const input = screen.getByRole('combobox', { name: 'Location Picker' });
    expect(input).toBeTruthy();

    fireEvent.focus(input);
    const polandOption = screen.getByRole('option', { name: /Poland/i });
    fireEvent.click(polandOption);
    expect(onChange).toHaveBeenCalledWith('PL');
  });

  it('renders DataForSeoLanguagePicker and handles option selection', () => {
    const onChange = vi.fn();
    const mockMarket = {
      code: 'US',
      label: 'United States',
      locationCode: 2840,
      languages: [
        { code: 'en', label: 'English' },
        { code: 'es', label: 'Spanish' },
      ],
    };

    render(
      <DataForSeoLanguagePicker
        value="en"
        onChange={onChange}
        market={mockMarket as any}
        ariaLabel="Language Picker"
      />,
    );

    const input = screen.getByRole('combobox', { name: 'Language Picker' });
    expect(input).toBeTruthy();

    fireEvent.focus(input);
    const spanishOption = screen.getByRole('option', { name: /Spanish/i });
    fireEvent.click(spanishOption);
    expect(onChange).toHaveBeenCalledWith('es');
  });
});
