import { render, screen, fireEvent, act } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { TrafficCheckerPanel } from '@/components/SeoTools/workspace/TrafficCheckerPanel';
import { useToolsStore } from '@/stores/toolsStore';
import { useProjectStore } from '@/stores/projectStore';
import { appLocale } from '@/services/localeFormat';

vi.mock('@/components/DataForSEO/cost/DataForSeoCostMeter', () => ({ DataForSeoCostMeter: () => <div data-testid="meter" /> }));

const tools = useToolsStore.getState();
const projects = useProjectStore.getState();
const analyzeDomain = vi.fn();
const setDomainQuery = vi.fn((value: string) => useToolsStore.setState({ domainQuery: value }));
const t = (k: string) => i18n.t(k);
const setup = (patch: object = {}, rootUrl?: string) => {
  useProjectStore.setState({ projects: [{ id: 'p', name: 'P', rootUrl }] as never, activeProjectId: 'p' });
  useToolsStore.setState({ domainQuery: '', domainOverview: null, isDomainLoading: false, domainError: null, analyzeDomain, setDomainQuery, ...patch } as never);
  return render(<TrafficCheckerPanel />);
};
beforeEach(async () => { await i18n.changeLanguage('en'); vi.clearAllMocks(); });
afterEach(() => { useToolsStore.setState(tools); useProjectStore.setState(projects); });

it('prefills the domain from the project root and shows the empty hint', () => {
  setup({}, 'https://root.test');
  expect(setDomainQuery).toHaveBeenCalledWith('https://root.test');
  expect((screen.getByLabelText(t('seoTools.domainInput')) as HTMLInputElement).value).toBe('https://root.test');
  expect(screen.getByText(t('seoTools.noTraffic'))).toBeTruthy();
  expect(screen.getByTestId('meter')).toBeTruthy();
});

it('does not prefill without a root url or when a query exists, and blocks blank lookups', () => {
  setup({}, undefined);
  expect(setDomainQuery).not.toHaveBeenCalled();
  const button = screen.getByRole('button', { name: t('seoTools.lookup') }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  fireEvent.submit(button.closest('form')!);
  expect(analyzeDomain).not.toHaveBeenCalled();
});

it('keeps a typed query and analyzes the trimmed value on submit', () => {
  setup({ domainQuery: '  typed.test ' }, 'https://root.test');
  expect(setDomainQuery).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: t('seoTools.lookup') }));
  expect(analyzeDomain).toHaveBeenCalledWith('typed.test');
  fireEvent.change(screen.getByLabelText(t('seoTools.domainInput')), { target: { value: 'new.test' } });
  expect(setDomainQuery).toHaveBeenCalledWith('new.test');
});

it('shows loading state and disables the button', () => {
  setup({ domainQuery: 'a.test', isDomainLoading: true });
  const button = screen.getByRole('button', { name: t('seoTools.loading') }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  expect(screen.queryByText(t('seoTools.noTraffic'))).toBeNull();
});

it('shows an error alert instead of the empty hint', () => {
  setup({ domainQuery: 'a.test', domainError: 'Quota exceeded' });
  expect(screen.getByRole('alert').textContent).toBe('Quota exceeded');
  expect(screen.queryByText(t('seoTools.noTraffic'))).toBeNull();
});

it('formats metrics in the app locale and uses a dash for missing values', () => {
  setup({ domainQuery: 'a.test', domainOverview: { organic_traffic: 12345, organic_keywords: 678, referring_domains: undefined, domain_rank: 0 } });
  expect(screen.getByText((12345).toLocaleString(appLocale()))).toBeTruthy();
  expect(screen.getByText('678')).toBeTruthy();
  expect(screen.getByText('0')).toBeTruthy();
  expect(screen.getByText('—')).toBeTruthy();
  expect(screen.getByText(t('domainResearchUi.referringDomains'))).toBeTruthy();
  expect(screen.queryByText(t('seoTools.noTraffic'))).toBeNull();
  act(() => useToolsStore.setState({ domainOverview: null }));
  expect(screen.queryByText(t('domainResearchUi.monthlyTraffic'))).toBeNull();
});

it('renders a dash for every metric when the overview has no numbers', () => {
  setup({ domainQuery: 'a.test', domainOverview: {} });
  expect(screen.getAllByText('—')).toHaveLength(4);
});
