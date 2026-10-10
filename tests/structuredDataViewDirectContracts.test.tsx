import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StructuredDataView } from '@/components/Results/StructuredDataView';
import { useAuditStore } from '@/stores/auditStore';
import { copyText } from '@/services/clipboard';
import { createAuditFixture } from './fixtures/audit';
import i18n from '@/i18n';

vi.mock('@/services/clipboard', () => ({ copyText: vi.fn() }));
const item = {
  format: 'JSON-LD', data_type: 'Article', content: { '@type': 'Article', name: 'Observed' },
  validation_issues: [{ code: 'missing-author', severity: 'warning' as const, message: 'Author is missing.', path: '$.author', recommendation: 'Add an author.' }],
};

describe('direct structured data view contracts', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.mocked(copyText).mockReset().mockResolvedValue(true);
    useAuditStore.setState({ showOnlyProblems: false });
  });
  afterEach(() => useAuditStore.setState({ showOnlyProblems: false }));

  it('renders validation evidence and confirms only a successful copy', async () => {
    render(<StructuredDataView audit={createAuditFixture({ structured_data: [item] })} />);
    expect(screen.getByText('JSON-LD')).toBeTruthy();
    expect(screen.getByText('Author is missing.')).toBeTruthy();
    expect(screen.getByText('$.author')).toBeTruthy();
    const copy = screen.getByRole('button', { name: i18n.t('legacyUi.structured.copy') });
    fireEvent.click(copy);
    await waitFor(() => expect(copyText).toHaveBeenCalledWith(JSON.stringify(item.content, null, 2)));
    await waitFor(() => expect(screen.getByRole('button', { name: i18n.t('legacyUi.structured.copied') })).toBeTruthy());
  });

  it('does not show copied feedback when clipboard rejects and exposes problem-only output', async () => {
    vi.mocked(copyText).mockResolvedValue(false);
    const view = render(<StructuredDataView audit={createAuditFixture({ structured_data: [item] })} />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('legacyUi.structured.copy') }));
    await waitFor(() => expect(copyText).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: i18n.t('legacyUi.structured.copy') })).toBeTruthy();
    act(() => useAuditStore.setState({ showOnlyProblems: true }));
    expect(await screen.findByRole('region', { name: i18n.t('componentUi.problems', { subject: i18n.t('sidebar.structured') }) })).toBeTruthy();
    expect(view.container.textContent).toContain('Warning');
  });
});
