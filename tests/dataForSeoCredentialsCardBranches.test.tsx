import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { DataForSeoCredentialsCard } from '@/components/Results/dataforseoAudit/DataForSeoCredentialsCard';
import { useAuditStore } from '@/stores/auditStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useProjectStore } from '@/stores/projectStore';

const audit = useAuditStore.getState();
const settings = useSettingsStore.getState();
const projects = useProjectStore.getState();
const fetchDataForSEO = vi.fn();
const saveDataForSeoCredentials = vi.fn().mockResolvedValue(undefined);
const t = (k: string) => i18n.t(k);
const setup = (patch: object = {}, creds = { login: '', password: '' }) => {
  useAuditStore.setState({ isDataForSEOLoading: false, dataforseoError: null, fetchDataForSEO, ...patch } as never);
  useSettingsStore.setState({ dataForSeoCredentials: creds, saveDataForSeoCredentials } as never);
};
beforeEach(async () => { await i18n.changeLanguage('en'); vi.clearAllMocks(); });
afterEach(() => { useAuditStore.setState(audit); useSettingsStore.setState(settings); useProjectStore.setState(projects); });

it('shows required state, placeholder domain and disables fetching without a domain', () => {
  setup();
  render(<DataForSeoCredentialsCard currentDomain="" />);
  expect(screen.getByText(t('dataforseo.credentialsRequired'))).toBeTruthy();
  expect(screen.getByText('—')).toBeTruthy();
  const fetchBtn = screen.getByRole('button', { name: t('dataforseo.fetchLiveMetrics') }) as HTMLButtonElement;
  expect(fetchBtn.disabled).toBe(true);
});

it('fetches live metrics for the domain and disables while loading', () => {
  setup({}, { login: 'l', password: 'p' });
  const { rerender } = render(<DataForSeoCredentialsCard currentDomain="example.com" />);
  expect(screen.getByText(t('dataforseo.credentialsSaved'))).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: t('dataforseo.fetchLiveMetrics') }));
  expect(fetchDataForSEO).toHaveBeenCalledWith('example.com');
  act(() => useAuditStore.setState({ isDataForSEOLoading: true }));
  rerender(<DataForSeoCredentialsCard currentDomain="example.com" />);
  expect((screen.getByRole('button', { name: t('dataforseo.fetchLiveMetrics') }) as HTMLButtonElement).disabled).toBe(true);
});

it('toggles the credential form, edits fields and saves with confirmation', async () => {
  setup({}, { login: 'old', password: 'pw' });
  render(<DataForSeoCredentialsCard currentDomain="example.com" />);
  fireEvent.click(screen.getByRole('button', { name: t('dataforseo.apiCredentials') }));
  const login = screen.getByPlaceholderText(t('dataforseo.loginPlaceholder')) as HTMLInputElement;
  const password = screen.getByPlaceholderText(t('dataforseo.passwordPlaceholder')) as HTMLInputElement;
  expect([login.value, password.value]).toEqual(['old', 'pw']);
  fireEvent.change(login, { target: { value: 'new' } });
  fireEvent.change(password, { target: { value: 'secret' } });
  fireEvent.click(screen.getByRole('button', { name: t('dataforseo.saveConnect') }));
  await waitFor(() => expect(screen.getByText(t('dataforseo.saved'))).toBeTruthy());
  expect(saveDataForSeoCredentials).toHaveBeenCalledWith({ login: 'new', password: 'secret' });
  fireEvent.click(screen.getByRole('button', { name: t('dataforseo.hideApiKeys') }));
  expect(screen.queryByPlaceholderText(t('dataforseo.loginPlaceholder'))).toBeNull();
});

it('syncs fields when stored credentials change', () => {
  setup({}, { login: 'a', password: 'b' });
  render(<DataForSeoCredentialsCard currentDomain="example.com" />);
  fireEvent.click(screen.getByRole('button', { name: t('dataforseo.apiCredentials') }));
  act(() => useSettingsStore.setState({ dataForSeoCredentials: { login: 'c', password: 'd' } } as never));
  expect((screen.getByPlaceholderText(t('dataforseo.loginPlaceholder')) as HTMLInputElement).value).toBe('c');
});

it.each([['HTTP 429 too many requests', true], ['Insufficient funds on account', true], ['Invalid credentials', false]])('classifies error "%s" as quota=%s', (message, quota) => {
  setup({ dataforseoError: message });
  render(<DataForSeoCredentialsCard currentDomain="example.com" />);
  expect(screen.getByText(message)).toBeTruthy();
  expect(!!screen.queryByText(t('dataforseo.quotaHint'))).toBe(quota);
});
