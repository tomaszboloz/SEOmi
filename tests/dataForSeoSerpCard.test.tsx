import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { DataForSeoSerpCard } from '@/components/Results/dataforseoAudit/DataForSeoSerpCard';
import { serpInputKey, defaultLocationCode, defaultLanguageCode } from '@/components/Results/dataforseoAudit/dataforseoAuditTypes';
import { DATAFORSEO_MARKETS, dataForSeoLanguage } from '@/services/dataforseo';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';

vi.mock('@/components/DataForSEO/DataForSeoPickers', () => ({
  DataForSeoLocationPicker: (p: { value: string; onChange: (v: string) => void }) => (
    <div>
      <output data-testid="loc">{p.value}</output>
      <button onClick={() => p.onChange('PL')}>pick-code</button>
      <button onClick={() => p.onChange('2840')}>pick-numeric</button>
      <button onClick={() => p.onChange('ZZZ')}>pick-unknown</button>
    </div>
  ),
  DataForSeoLanguagePicker: (p: { value: string; onChange: (v: string) => void }) => (
    <div><output data-testid="lang">{p.value}</output><button onClick={() => p.onChange('xx')}>pick-lang</button></div>
  ),
}));

const fetchSerp = vi.fn();
const type = (el: HTMLElement, text: string) => fireEvent.change(el, { target: { value: (el as HTMLInputElement).value + text } });
const market = (code: string) => DATAFORSEO_MARKETS.find((m) => m.code === code)!;
const setStore = (dataforseoSerp: unknown[] = [], isDataForSEOLoading = false) =>
  useAuditStore.setState({ dataforseoSerp, isDataForSEOLoading, fetchDataForSEOSerp: fetchSerp } as never);

beforeEach(async () => {
  await i18n.changeLanguage('en');
  localStorage.clear();
  fetchSerp.mockReset();
  setStore();
  useProjectStore.setState({ activeProjectId: 'p1' });
});

describe('DataForSeoSerpCard input', () => {
  it('disables submit for blank keywords and ignores a forced submit', () => {
    const { container } = render(<DataForSeoSerpCard />);
    const submit = screen.getByRole('button', { name: i18n.t('dataforseo.inspectSerp') });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    type(screen.getByLabelText(i18n.t('dataforseo.keywordLabel')), '   ');
    fireEvent.submit(container.querySelector('form')!);
    expect(fetchSerp).not.toHaveBeenCalled();
  });

  it('searches with the trimmed keyword, location and resolved language', () => {
    render(<DataForSeoSerpCard />);
    type(screen.getByLabelText(i18n.t('dataforseo.keywordLabel')), '  seo audit ');
    fireEvent.click(screen.getByRole('button', { name: i18n.t('dataforseo.inspectSerp') }));
    expect(fetchSerp).toHaveBeenCalledWith('seo audit', defaultLocationCode, dataForSeoLanguage(String(defaultLocationCode), defaultLanguageCode));
  });

  it('switches market by code and resets a language the market does not offer', () => {
    const pl = market('PL');
    render(<DataForSeoSerpCard />);
    fireEvent.click(screen.getByText('pick-code'));
    expect(screen.getByTestId('loc').textContent).toBe(pl.code);
    expect(screen.getByTestId('lang').textContent).toBe(pl.languages[0]!.code);
    fireEvent.click(screen.getByText('pick-lang'));
    expect(screen.getByTestId('lang').textContent).toBe('xx');
  });

  it('keeps the language when a numeric location is chosen and falls back to the default market for unknown codes', () => {
    render(<DataForSeoSerpCard />);
    fireEvent.click(screen.getByText('pick-code'));
    fireEvent.click(screen.getByText('pick-lang'));
    fireEvent.click(screen.getByText('pick-numeric'));
    expect(screen.getByTestId('loc').textContent).toBe('US');
    expect(screen.getByTestId('lang').textContent).toBe('xx');
    fireEvent.click(screen.getByText('pick-code'));
    fireEvent.click(screen.getByText('pick-unknown'));
    expect(screen.getByTestId('loc').textContent).toBe('US');
  });
});

describe('DataForSeoSerpCard persistence and results', () => {
  it('restores a valid saved input and persists later edits', () => {
    const pl = market('PL');
    localStorage.setItem(serpInputKey('p1'), JSON.stringify({ keyword: 'saved', locationCode: pl.locationCode, languageCode: pl.languages[0]!.code }));
    render(<DataForSeoSerpCard />);
    expect((screen.getByLabelText(i18n.t('dataforseo.keywordLabel')) as HTMLInputElement).value).toBe('saved');
    expect(screen.getByTestId('loc').textContent).toBe('PL');
    type(screen.getByLabelText(i18n.t('dataforseo.keywordLabel')), '!');
    expect(JSON.parse(localStorage.getItem(serpInputKey('p1'))!)).toMatchObject({ keyword: 'saved!', locationCode: pl.locationCode });
  });

  it('falls back to defaults for invalid saved values and clears without a project', () => {
    localStorage.setItem(serpInputKey('p1'), JSON.stringify({ keyword: 5, locationCode: 1, languageCode: 'nope' }));
    const { rerender } = render(<DataForSeoSerpCard />);
    expect((screen.getByLabelText(i18n.t('dataforseo.keywordLabel')) as HTMLInputElement).value).toBe('');
    expect(screen.getByTestId('lang').textContent).toBe(defaultLanguageCode);
    localStorage.setItem(serpInputKey('p1'), JSON.stringify({ locationCode: market('PL').locationCode, languageCode: 'nope' }));
    useProjectStore.setState({ activeProjectId: null });
    rerender(<DataForSeoSerpCard />);
    expect(screen.getByTestId('loc').textContent).toBe('US');
    expect(localStorage.getItem(serpInputKey('p1'))).toContain('nope');
  });

  it('uses the first market language when the saved language is unsupported', () => {
    const pl = market('PL');
    localStorage.setItem(serpInputKey('p1'), JSON.stringify({ locationCode: pl.locationCode, languageCode: 'nope' }));
    render(<DataForSeoSerpCard />);
    expect(screen.getByTestId('lang').textContent).toBe(pl.languages[0]!.code);
  });

  it('renders ranked rows with fallback positions, or the empty state', () => {
    setStore([{ rank_group: 3, domain: 'a.com', title: 'A', description: 'd', url: 'https://a.com' }, { domain: 'b.com', title: 'B', description: 'e', url: 'https://b.com' }]);
    const { unmount } = render(<DataForSeoSerpCard />);
    expect(screen.getByText('#3')).toBeTruthy();
    expect(screen.getByText('#2')).toBeTruthy();
    expect(screen.getAllByText(i18n.t('dataforseo.visit'))[1]!.closest('a')!.getAttribute('href')).toBe('https://b.com');
    unmount();
    setStore([], true);
    render(<DataForSeoSerpCard />);
    expect(screen.getByText(i18n.t('dataforseo.emptySerp'))).toBeTruthy();
  });
});
