import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import i18n from '@/i18n';
import { DataForSeoTaskLogCard } from '@/components/Results/dataforseoAudit/DataForSeoTaskLogCard';
import { useProjectStore } from '@/stores/projectStore';

const { readMock, clearMock } = vi.hoisted(() => ({ readMock: vi.fn(), clearMock: vi.fn() }));
vi.mock('@/services/dataforseo', () => ({ readDataForSeoTaskLog: readMock, clearDataForSeoTaskLog: clearMock }));

const rec = (over: Record<string, unknown> = {}) => ({
  projectId: 'p1', ok: true, endpoint: '/v3/serp/google', taskId: 'tid-1', statusCode: 20000, statusMessage: 'Ok.',
  cost: 0.0123, timeSeconds: 1.5, resultCount: 3, requestedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T00:00:01Z', ...over,
});

describe('DataForSeoTaskLogCard', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    readMock.mockReset();
    clearMock.mockReset();
    useProjectStore.setState({ activeProjectId: 'p1' } as never);
  });

  it('shows the empty state and no clear button', () => {
    readMock.mockReturnValue([]);
    render(<DataForSeoTaskLogCard />);
    expect(screen.getByText(i18n.t('dataforseo.noRequests'))).toBeTruthy();
    expect(screen.queryByText(i18n.t('dataforseo.clearHistory'))).toBeNull();
    expect(screen.getByText('0 / 100')).toBeTruthy();
    expect(readMock).toHaveBeenCalledWith('p1');
  });

  it('renders ok, error and missing-status rows with formatted values', () => {
    readMock.mockReturnValue([
      rec(),
      rec({ ok: false, statusCode: 40000, endpoint: '/v3/other', taskId: null, cost: null, timeSeconds: null, statusMessage: null, completedAt: 'not-a-date' }),
      rec({ ok: false, statusCode: null, endpoint: '/v3/third', completedAt: '2026-01-02T00:00:00Z' }),
    ]);
    render(<DataForSeoTaskLogCard />);
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText(`${i18n.t('dataforseo.statusOk')} · 20000`).getAttribute('title')).toBe('Ok.');
    expect(within(rows[0]).getByText('serp/google')).toBeTruthy();
    expect(within(rows[0]).getByText('$0.0123')).toBeTruthy();
    expect(within(rows[0]).getByText('1.500 s')).toBeTruthy();
    expect(within(rows[1]).getByText(`${i18n.t('dataforseo.statusError')} · 40000`).hasAttribute('title')).toBe(false);
    expect(within(rows[1]).getByText(i18n.t('dataforseo.notInResponse'))).toBeTruthy();
    expect(within(rows[1]).getByText('not-a-date')).toBeTruthy();
    expect(within(rows[1]).getAllByText('—')).toHaveLength(2);
    expect(within(rows[2]).getByText(i18n.t('dataforseo.statusMissing'))).toBeTruthy();
  });

  it('limits to five rows, toggles show all and clears history', () => {
    readMock.mockReturnValue(Array.from({ length: 7 }, (_, i) => rec({ taskId: `t${i}` })));
    render(<DataForSeoTaskLogCard />);
    expect(screen.getAllByRole('row')).toHaveLength(6);
    fireEvent.click(screen.getByText(i18n.t('dataforseo.showAll', { count: 7 })));
    expect(screen.getAllByRole('row')).toHaveLength(8);
    fireEvent.click(screen.getByText(i18n.t('dataforseo.showRecent')));
    expect(screen.getAllByRole('row')).toHaveLength(6);
    fireEvent.click(screen.getByText(i18n.t('dataforseo.clearHistory')));
    expect(clearMock).toHaveBeenCalledWith('p1');
    expect(screen.getByText('0 / 100')).toBeTruthy();
  });

  it('refreshes on the task event and stops listening after unmount', () => {
    readMock.mockReturnValue([]);
    const { unmount } = render(<DataForSeoTaskLogCard />);
    readMock.mockReturnValue([rec()]);
    act(() => { window.dispatchEvent(new Event('seomi:dataforseo-task')); });
    expect(screen.getByText('1 / 100')).toBeTruthy();
    unmount();
    const calls = readMock.mock.calls.length;
    window.dispatchEvent(new Event('seomi:dataforseo-task'));
    expect(readMock.mock.calls.length).toBe(calls);
  });
});
