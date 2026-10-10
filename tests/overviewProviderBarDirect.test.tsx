import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { OverviewDataForSeoBar } from '@/components/Results/overview/OverviewDataForSeoBar';
import { useAuditStore } from '@/stores/auditStore';
import { createAuditFixture } from './fixtures/audit';
import i18n from '@/i18n';

const original = useAuditStore.getState();
afterEach(() => useAuditStore.setState(original));
const label = (key: string) => i18n.t(`legacyUi.overview.${key}`);

describe('provider overview evidence boundaries', () => {
  it('shows unavailable metrics, connection errors and explicit navigation', () => {
    useAuditStore.setState({ dataforseoData: null, dataforseoError: null });
    render(<OverviewDataForSeoBar audit={createAuditFixture()} />);
    expect(screen.getAllByText('—')).toHaveLength(3);
    expect(screen.getByText(label('connectionRequired'))).toBeTruthy();
    expect(screen.getByText(label('connectPrompt'))).toBeTruthy();
    act(() => useAuditStore.setState({ dataforseoError: 'Provider unavailable' }));
    expect(screen.getByText('Provider unavailable')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: label('exploreSerp') }));
    expect(useAuditStore.getState().activeTab).toBe('dataforseo');
  });
  it('preserves measured zero values and uses requested or malformed URL fallbacks', () => {
    useAuditStore.setState({ dataforseoError: 'old error', dataforseoData: {
      target: 'example.test', total_backlinks: 0, referring_domains: 0, referring_main_domains: 0,
      rank: 0, dofollow_backlinks: 0, broken_backlinks: 0,
    } });
    const view = render(<OverviewDataForSeoBar audit={createAuditFixture({ final_url: '' })} />);
    expect(screen.getAllByText('0')).toHaveLength(2);
    expect(screen.getByText('0/100')).toBeTruthy();
    expect(screen.queryByText('old error')).toBeNull();
    expect(screen.getByText(i18n.t('legacyUi.overview.liveDomainMetrics', { domain: 'example.test' }))).toBeTruthy();
    view.rerender(<OverviewDataForSeoBar audit={createAuditFixture({ final_url: 'malformed URL' })} />);
    expect(screen.getByText(i18n.t('legacyUi.overview.liveDomainMetrics', { domain: 'malformed URL' }))).toBeTruthy();
    view.rerender(<OverviewDataForSeoBar audit={createAuditFixture({ final_url: '', url: 'invalid requested URL' })} />);
    expect(screen.getByText(i18n.t('legacyUi.overview.liveDomainMetrics', { domain: 'invalid requested URL' }))).toBeTruthy();
  });
});
