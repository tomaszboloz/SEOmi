import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataForSeoSerpCard } from '@/components/Results/dataforseoAudit/DataForSeoSerpCard';
import { serpInputKey, defaultLanguageCode } from '@/components/Results/dataforseoAudit/dataforseoAuditTypes';
import { useProjectStore } from '@/stores/projectStore';

const catalog = vi.hoisted(() => {
  const us = { code: 'US', locationCode: 2840, languages: [{ code: 'en', label: 'English' }] };
  const bare = { code: 'XX', locationCode: 9999, languages: [] as Array<{ code: string; label: string }> };
  return { us, bare, markets: [us, bare] };
});

vi.mock('@/services/dataforseo', () => ({
  DATAFORSEO_MARKETS: catalog.markets,
  dataForSeoLanguage: (_c: string, l: string) => l,
  dataForSeoMarketByLocation: (code: number) => catalog.markets.find((m) => m.locationCode === code) ?? catalog.us,
}));
vi.mock('@/components/DataForSEO/DataForSeoPickers', () => ({
  DataForSeoLocationPicker: (p: { onChange: (v: string) => void }) => <button onClick={() => p.onChange('XX')}>pick-bare</button>,
  DataForSeoLanguagePicker: (p: { value: string }) => <output data-testid="lang">{p.value}</output>,
}));

beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({ activeProjectId: 'p1' });
});

describe('DataForSeoSerpCard with a market that has no languages', () => {
  it('falls back to the default language when a saved market offers none', () => {
    localStorage.setItem(serpInputKey('p1'), JSON.stringify({ locationCode: 9999, languageCode: 'fr' }));
    render(<DataForSeoSerpCard />);
    expect(screen.getByTestId('lang').textContent).toBe(defaultLanguageCode);
  });

  it('falls back to the default language when the chosen market offers none', () => {
    render(<DataForSeoSerpCard />);
    fireEvent.click(screen.getByText('pick-bare'));
    expect(screen.getByTestId('lang').textContent).toBe(defaultLanguageCode);
  });
});
