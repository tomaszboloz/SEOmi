import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { KeywordResearchSearchForm } from '@/components/Keywords/keywordResearch/KeywordResearchSearchForm';

vi.mock('@/components/DataForSEO/DataForSeoPickers', () => ({
  DataForSeoLocationPicker: ({ onChange }: { onChange: (value: string) => void }) => <button type="button" onClick={() => onChange('DE')}>country picker</button>,
  DataForSeoLanguagePicker: ({ onChange }: { onChange: (value: string) => void }) => <button type="button" onClick={() => onChange('de')}>language picker</button>,
}));

const t = ((key: string, options?: { count?: number }) => `${key}${options?.count === undefined ? '' : `:${options.count}`}`) as never;
const props = () => ({
  inputQuery: 'seo', setInputQuery: vi.fn(), selectedCountry: 'PL', setSelectedCountry: vi.fn(),
  selectedLanguage: 'pl', setSelectedLanguage: vi.fn(), isLoading: false, error: null,
  handleSearch: vi.fn(), t,
});

describe('direct keyword research search form contracts', () => {
  it('forwards query, country, derived language and language changes', () => {
    const input = props();
    render(<KeywordResearchSearchForm {...input} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new query' } });
    expect(input.setInputQuery).toHaveBeenCalledWith('new query');
    fireEvent.click(screen.getByRole('button', { name: 'country picker' }));
    expect(input.setSelectedCountry).toHaveBeenCalledWith('DE');
    expect(input.setSelectedLanguage).toHaveBeenCalledWith('de');
    fireEvent.click(screen.getByRole('button', { name: 'language picker' }));
    expect(input.setSelectedLanguage).toHaveBeenLastCalledWith('de');
  });

  it('submits, disables while loading and renders provider errors', () => {
    const input = props();
    const view = render(<KeywordResearchSearchForm {...input} isLoading error="provider unavailable" />);
    fireEvent.submit(view.container.querySelector('form')!);
    expect(input.handleSearch).toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'keywordResearchUi.analyzing' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('provider unavailable')).toBeTruthy();
  });
});
