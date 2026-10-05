import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import i18n from '@/i18n';
import { appLocale } from '@/services/localeFormat';
import { DomainComparisonTable } from '@/components/Domain/domainOverview/DomainComparisonTable';
import type { DomainComparisonData } from '@/types';

const empty = { organic_traffic: null, organic_keywords: null, domain_rank: null, referring_domains: null, total_backlinks: null, dofollow_ratio: null };
const rows = [
  { ...empty, domain: 'me.test', organic_traffic: 1000, organic_keywords: 2500, domain_rank: 40, referring_domains: 12345, total_backlinks: 99999, dofollow_ratio: 61,
    top_keywords: [{ keyword: 'alpha', position: 3 }, { keyword: 'beta', position: null }, ...['c', 'd', 'e', 'f'].map((k) => ({ keyword: k, position: 9 }))],
    top_pages: [{ url: 'https://me.test/a' }], competitors: [{ domain: 'rival.test', common_keywords: 7 }, { domain: 'other.test', common_keywords: null }] },
  { ...empty, domain: 'half.test', organic_traffic: 250, dofollow_ratio: undefined, top_pages: [{ url: 'https://half.test/p' }] },
  { ...empty, domain: 'none.test' },
  { ...empty, domain: 'kwonly.test', top_keywords: [{ keyword: 'solo', position: 1 }] },
  { ...empty, domain: 'zero.test', organic_traffic: 0, dofollow_ratio: 0, competitors: [] },
];
const comparison = { target: 'me.test', rows } as unknown as DomainComparisonData;
const rowOf = (name: string) => screen.getByText(name).closest('tr') as HTMLElement;
const widthOf = (row: HTMLElement) => (row.querySelector('span.bg-violet-400') as HTMLElement).style.width;
const ui = (k: string) => i18n.t(`domainResearchUi.${k}`);

describe('DomainComparisonTable', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    render(<DomainComparisonTable comparison={comparison} t={i18n.t.bind(i18n) as never} />);
  });

  it('renders formatted metrics for a complete row', () => {
    const cells = within(rowOf('me.test')).getAllByRole('cell').map((c) => c.textContent);
    expect(cells.slice(1)).toEqual([(1000).toLocaleString(appLocale()), (2500).toLocaleString(appLocale()), '40', (12345).toLocaleString(appLocale()), (99999).toLocaleString(appLocale()), '61%']);
  });

  it('shows dashes for missing metrics including undefined dofollow ratio', () => {
    expect(within(rowOf('none.test')).getAllByRole('cell').slice(1).map((c) => c.textContent)).toEqual(['—', '—', '—', '—', '—', '—']);
    expect(within(rowOf('half.test')).getAllByRole('cell')[6].textContent).toBe('—');
    expect(within(rowOf('zero.test')).getAllByRole('cell')[6].textContent).toBe('0%');
  });

  it('scales the traffic bar relative to the maximum and handles null and zero', () => {
    expect(widthOf(rowOf('me.test'))).toBe('100%');
    expect(widthOf(rowOf('half.test'))).toBe('25%');
    expect(widthOf(rowOf('none.test'))).toBe('0%');
    expect(widthOf(rowOf('zero.test'))).toBe('0%');
  });

  it('marks only the target domain as the project', () => {
    expect(screen.getAllByText(ui('project'))).toHaveLength(1);
    expect(within(rowOf('me.test')).getByText(ui('project'))).toBeTruthy();
  });

  it('shows details only when keywords, pages or competitors exist', () => {
    expect(rowOf('me.test').querySelector('details')).toBeTruthy();
    expect(rowOf('half.test').querySelector('details')).toBeTruthy();
    expect(rowOf('none.test').querySelector('details')).toBeNull();
    expect(rowOf('zero.test').querySelector('details')).toBeNull();
  });

  it('lists up to five keywords with positions and competitor overlap', () => {
    const me = within(rowOf('me.test'));
    expect(me.getByText('#3')).toBeTruthy();
    expect(me.getByTitle('beta').nextSibling?.textContent).toBe('—');
    expect(me.queryByText('f')).toBeNull();
    expect(me.getByTitle('https://me.test/a')).toBeTruthy();
    expect(me.getByText('rival.test').nextSibling?.textContent).toBe('7');
    expect(me.getByText('other.test').nextSibling?.textContent).toBe('—');
  });

  it('renders keyword-only details without pages or competitors', () => {
    const row = within(rowOf('kwonly.test'));
    expect(row.getByText('#1')).toBeTruthy();
    expect(row.queryByText(ui('competitors'))).toBeNull();
    expect(row.queryAllByTitle(/^https:/)).toHaveLength(0);
  });

  it('omits the competitor block when a row has none', () => {
    expect(within(rowOf('half.test')).queryByText(ui('competitors'))).toBeNull();
    expect(within(rowOf('half.test')).getByTitle('https://half.test/p')).toBeTruthy();
  });
});
