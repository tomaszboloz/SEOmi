import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { DataForSEOClient } from '@/services/dataforseo';
import { readSpend, writeBudget } from '@/services/dataforseo/dataforseoBudget';
import { readAccount } from '@/services/dataforseo/dataforseoAccount';
import { DataForSeoCostMeter } from '@/components/DataForSEO/cost/DataForSeoCostMeter';
import { DataForSeoBudgetSettings } from '@/components/DataForSEO/cost/DataForSeoBudgetSettings';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const serp = (cost: number) => json({ cost, tasks: [{ status_code: 20000, cost, result: [{ items: [] }] }] });
const userData = () => json({ cost: 0, tasks: [{ status_code: 20000, result: [{ login: 'me', money: { balance: 20 } }] }] });

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage('en');
  localStorage.setItem('seomi_active_project_v1', 'p1');
  useProjectStore.setState({ activeProjectId: 'p1' });
  useSettingsStore.setState({ dataForSeoCredentials: { login: 'l', password: 'p' } });
});
afterEach(() => vi.restoreAllMocks());

describe('cost accounting on real client calls', () => {
  it('records the reported request cost and lowers the estimated balance', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(userData()).mockResolvedValueOnce(serp(0.0025));
    const client = new DataForSEOClient('l', 'p');
    expect(await client.getAccount()).toMatchObject({ balanceUsd: 20 });
    await client.getSerpCompetitors('seo', 2616, 'pl');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(readSpend('p1')).toMatchObject({ totalUsd: 0.0025, calls: 2, lastCall: { endpoint: '/v3/serp/google/organic/live/regular', costUsd: 0.0025 } });
    expect(readAccount('p1')?.estimatedBalanceUsd).toBe(19.9975);
  });

  it('blocks a paid call before any network traffic once the monthly limit is used', async () => {
    writeBudget('p1', { monthlyLimitUsd: 0.002, warnAtPercent: 80 });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(serp(0.0025));
    const client = new DataForSEOClient('l', 'p');
    await client.getSerpCompetitors('seo', 2616, 'pl');
    await expect(client.getSerpCompetitors('seo 2', 2616, 'pl')).rejects.toThrow(/monthly limit reached/);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe('cost meter', () => {
  it('shows the last call, month total and balance and updates live', async () => {
    render(<DataForSeoCostMeter />);
    expect(screen.getByRole('status').textContent).toContain(i18n.t('dataforseoCost.noCallsYet'));
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(userData()).mockResolvedValueOnce(serp(0.0025));
    await act(async () => { await new DataForSEOClient('l', 'p').getAccount(); await new DataForSEOClient('l', 'p').getSerpCompetitors('seo', 2616, 'pl'); });
    const text = screen.getByRole('status').textContent ?? '';
    expect(text).toContain('$0.0025');
    expect(text).toContain('serp/google/organic/live/regular');
    expect(text).toContain('$19.9975');
    expect(text).toContain(i18n.t('dataforseoCost.monthNoLimit', { spent: '$0.0025', calls: 2 }));
  });

  it('warns near the cap and marks it exceeded', () => {
    writeBudget('p1', { monthlyLimitUsd: 1, warnAtPercent: 50 });
    localStorage.setItem('seomi_project_p1_dataforseo_spend_v1', JSON.stringify({ month: readSpend('p1').month, totalUsd: 0.6, calls: 3, lastCostByEndpoint: {}, lastCall: null }));
    const view = render(<DataForSeoCostMeter />);
    expect(screen.getByText(i18n.t('dataforseoCost.warning'))).toBeTruthy();
    act(() => { writeBudget('p1', { monthlyLimitUsd: 0.5, warnAtPercent: 50 }); });
    expect(screen.getByText(i18n.t('dataforseoCost.exceeded'))).toBeTruthy();
    view.unmount();
  });

  it('renders nothing without a project', () => {
    useProjectStore.setState({ activeProjectId: null });
    expect(render(<DataForSeoCostMeter />).container.textContent).toBe('');
  });
});

describe('budget settings', () => {
  it('defaults to "no limit = account balance" and reveals the monthly cap only when unchecked', () => {
    render(<DataForSeoBudgetSettings />);
    const noLimit = screen.getByRole('checkbox', { name: i18n.t('dataforseoCost.noLimitOption') }) as HTMLInputElement;
    expect(noLimit.checked).toBe(true);
    expect(screen.queryByLabelText(i18n.t('dataforseoCost.limitLabel'))).toBeNull();
    fireEvent.click(noLimit);
    fireEvent.change(screen.getByLabelText(i18n.t('dataforseoCost.limitLabel')), { target: { value: '12,5' } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('dataforseoCost.saveLimit') }));
    expect(screen.getByText(i18n.t('dataforseoCost.limitSaved', { limit: '$12.50' }))).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('seomi_project_p1_dataforseo_budget_v1')!)).toEqual({ monthlyLimitUsd: 12.5, warnAtPercent: 80 });
  });

  it('rejects an empty or invalid cap and can return to no limit', () => {
    render(<DataForSeoBudgetSettings />);
    fireEvent.click(screen.getByRole('checkbox', { name: i18n.t('dataforseoCost.noLimitOption') }));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('dataforseoCost.saveLimit') }));
    expect(screen.getByText(i18n.t('dataforseoCost.invalidLimit'))).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: i18n.t('dataforseoCost.noLimitOption') }));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('dataforseoCost.saveLimit') }));
    expect(screen.getByText(i18n.t('dataforseoCost.limitRemoved'))).toBeTruthy();
  });

  it('checks the balance through the free account endpoint', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(userData());
    render(<DataForSeoBudgetSettings />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: i18n.t('dataforseoCost.checkBalance') })); });
    expect(screen.getAllByText('$20.00').length).toBeGreaterThan(0);
  });

  it('asks for credentials before checking the balance', async () => {
    useSettingsStore.setState({ dataForSeoCredentials: { login: '', password: '' } });
    render(<DataForSeoBudgetSettings />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: i18n.t('dataforseoCost.checkBalance') })); });
    expect(screen.getByText(i18n.t('dataforseo.enterCredentials'))).toBeTruthy();
  });
});
