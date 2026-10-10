import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataForSeoBudgetSettings } from '@/components/DataForSEO/cost/DataForSeoBudgetSettings';
import { DataForSEOClient } from '@/services/dataforseo';
import * as budgets from '@/services/dataforseo/dataforseoBudget';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import i18n from '@/i18n';

const project = useProjectStore.getState();
const settings = useSettingsStore.getState();
const label = (key: string) => i18n.t(`dataforseoCost.${key}`);
beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({ activeProjectId: 'budget-errors' });
  useSettingsStore.setState({ dataForSeoCredentials: { login: 'fixture-login', password: 'fixture-password' } });
});
afterEach(() => {
  vi.restoreAllMocks();
  useProjectStore.setState(project);
  useSettingsStore.setState(settings);
  localStorage.clear();
});

describe('budget provider and persistence error contracts', () => {
  it('asks for a selected project before offering any spending controls', () => {
    useProjectStore.setState({ activeProjectId: null });
    render(<DataForSeoBudgetSettings />);
    expect(screen.getByText(label('selectProject'))).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('reports an unavailable account without inventing a balance', async () => {
    vi.spyOn(DataForSEOClient.prototype, 'getAccount').mockResolvedValueOnce(null);
    render(<DataForSeoBudgetSettings />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: label('checkBalance') })));
    expect(screen.getByRole('status').textContent).toBe(label('balanceUnavailable'));
    expect(screen.getByText('—')).toBeTruthy();
  });
  it.each([new Error('Account error'), 'Provider rejected'])(
    'reports account rejection %s and releases the loading control', async (failure) => {
      vi.spyOn(DataForSEOClient.prototype, 'getAccount').mockRejectedValueOnce(failure);
      render(<DataForSeoBudgetSettings />);
      const button = screen.getByRole('button', { name: label('checkBalance') });
      await act(async () => fireEvent.click(button));
      expect(screen.getByRole('status').textContent).toBe(failure instanceof Error ? failure.message : failure);
      expect((button as HTMLButtonElement).disabled).toBe(false);
    },
  );
  it('preserves a non-Error persistence rejection as a readable status', () => {
    const write = vi.spyOn(budgets, 'writeBudget').mockImplementationOnce(() => { throw 'Budget storage rejected'; });
    render(<DataForSeoBudgetSettings />);
    fireEvent.click(screen.getByRole('button', { name: label('saveLimit') }));
    expect(write).toHaveBeenCalledWith('budget-errors', { monthlyLimitUsd: null, warnAtPercent: 80 });
    expect(screen.getByRole('status').textContent).toBe('Budget storage rejected');
  });

  it('updates warn percentage input when limit is enabled', () => {
    render(<DataForSeoBudgetSettings />);
    const noLimitCheckbox = screen.getByRole('checkbox');
    fireEvent.click(noLimitCheckbox);
    const warnInput = screen.getByDisplayValue('80');
    fireEvent.change(warnInput, { target: { value: '85' } });
    expect((warnInput as HTMLInputElement).value).toBe('85');
  });
});
