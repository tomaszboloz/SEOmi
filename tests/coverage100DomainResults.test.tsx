import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { DataForSeoCredentialsCard } from '@/components/Results/dataforseoAudit/DataForSeoCredentialsCard';
import { DataForSeoSummaryCard } from '@/components/Results/dataforseoAudit/DataForSeoSummaryCard';
import { MetadataAccessibilityFindings } from '@/components/Results/metadata/MetadataAccessibilityFindings';
import { MetadataAccessibilityHidden } from '@/components/Results/metadata/MetadataAccessibilityHidden';
import { DomainComparisonTable } from '@/components/Domain/domainOverview/DomainComparisonTable';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';

vi.mock('@/components/Results/ShowOnPageButton', () => ({ ShowOnPageButton: () => <i data-testid="show" /> }));

beforeEach(async () => {
  await i18n.changeLanguage('en');
  act(() => {
    useAuditStore.setState({ dataforseoData: null, isDataForSEOLoading: false, dataforseoError: null, fetchDataForSEO: vi.fn() } as never);
    useSettingsStore.setState({ dataForSeoCredentials: { login: '', password: '' }, saveDataForSeoCredentials: vi.fn() } as never);
    useProjectStore.setState({ activeProjectId: null } as never);
  });
});

describe('coverage100 results and metadata edges', () => {
  it('redacts stored DataForSEO secret markers and computes a live ratio', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const fetchLive = vi.fn();
    act(() => {
      useSettingsStore.setState({ dataForSeoCredentials: { login: '__seomi_secret_present__', password: '__seomi_secret_present__' }, saveDataForSeoCredentials: save } as never);
      useAuditStore.setState({ dataforseoData: { total_backlinks: 100, referring_domains: 2, dofollow_backlinks: 80, rank: 20, broken_backlinks: 3 }, isDataForSEOLoading: false, dataforseoError: 'HTTP 429 quota reached', fetchDataForSEO: fetchLive } as never);
      useProjectStore.setState({ activeProjectId: 'p1' } as never);
    });
    const { unmount } = render(<DataForSeoCredentialsCard currentDomain="example.com" />);
    expect(screen.getByText(i18n.t('dataforseo.quotaHint'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'API credentials' }));
    expect((screen.getByPlaceholderText(i18n.t('dataforseo.loginPlaceholder')) as HTMLInputElement).value).toBe('');
    expect((screen.getByPlaceholderText(i18n.t('dataforseo.passwordPlaceholder')) as HTMLInputElement).value).toBe('');
    fireEvent.change(screen.getByPlaceholderText(i18n.t('dataforseo.loginPlaceholder')), { target: { value: 'user' } });
    fireEvent.change(screen.getByPlaceholderText(i18n.t('dataforseo.passwordPlaceholder')), { target: { value: 'pass' } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('dataforseo.saveConnect') }));
    expect(save).toHaveBeenCalledWith({ login: 'user', password: 'pass' });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('dataforseo.fetchLiveMetrics') }));
    expect(fetchLive).toHaveBeenCalledWith('example.com');
    unmount();
    render(<DataForSeoCredentialsCard currentDomain="" />);
    expect(screen.getByText('—')).toBeTruthy();
    render(<DataForSeoSummaryCard />);
    expect(screen.getByText('80%')).toBeTruthy();
    act(() => {
      useAuditStore.setState({ dataforseoData: null } as never);
    });
    render(<DataForSeoSummaryCard />);
    expect(screen.getByText(i18n.t('dataforseo.runLiveMetric'))).toBeTruthy();
    act(() => {
      useAuditStore.setState({ dataforseoData: { total_backlinks: 0, referring_domains: 0, dofollow_backlinks: 0, rank: 0, broken_backlinks: 0 } } as never);
    });
    render(<DataForSeoSummaryCard />);
    expect(screen.getByText(`✓ ${i18n.t('dataforseo.noBrokenLinks')}`)).toBeTruthy();
  });

  it('handles omitted accessibility counters and listed-control fallbacks', () => {
    render(<MetadataAccessibilityFindings audit={{ url: 'https://x.test/', final_url: '', accessibility: { findings: [{ code: 'accessibility-form-controls-unlabeled', severity: 'warning', message: 'm', evidence: 'e', recommendation: 'r', elements: [{ dom_position: 1, dom_query: 'input', html_snippet: '<input>' }] }] } } as never} />);
    const copyBtn = screen.queryByRole('button', { name: /accessibility.copyEvidence/ });
    if (copyBtn) fireEvent.click(copyBtn);
    render(<MetadataAccessibilityHidden audit={{ url: 'https://x.test/' } as never} />);
    render(<MetadataAccessibilityHidden audit={{ url: 'https://x.test/', accessibility: { hidden_form_control_count: 2, anti_spam_text_control_count: 2 } } as never} />);
    expect(screen.getAllByText(i18n.t('accessibility.limitFirst', { shown: 0 }))).toHaveLength(2);
    render(<MetadataAccessibilityHidden audit={{
      url: 'https://x.test/',
      accessibility: {
        hidden_form_control_count: 2,
        hidden_form_controls: [
          { dom_position: 1, dom_query: '#h1', html_snippet: '<input hidden>', line: 5, column: 2 },
          { dom_position: 2, dom_query: '#h2', html_snippet: '<input hidden>' },
        ],
        anti_spam_text_control_count: 1,
        anti_spam_text_controls: [
          { dom_position: 3, dom_query: '#s1', html_snippet: '<input name="trap">' },
        ],
      },
    } as never} />);
    expect(screen.getByText('#h1')).toBeTruthy();
    expect(screen.getByText('#s1')).toBeTruthy();
  });

  it('falls back for an undefined competitors list', () => {
    render(<DomainComparisonTable comparison={{ target: 'x.test', rows: [{ domain: 'x.test', organic_traffic: 0, organic_keywords: null, domain_rank: null, referring_domains: null, total_backlinks: null, dofollow_ratio: null, competitors: null }] } as never} t={i18n.t.bind(i18n) as never} />);
    expect(screen.getByText('x.test')).toBeTruthy();
  });
});
