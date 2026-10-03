import { act, renderHook, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PageSpeedWorkspace } from '../src/components/Performance/PageSpeedWorkspace';
import { useProjectStore } from '../src/stores/projectStore';
import { CruxReport, PageSpeedReport } from '../src/services/pagespeed';
import i18n from '../src/i18n';
import { usePerformanceWorkspace } from '@/components/Performance/usePerformanceWorkspace';
import { readPageSpeedSnapshots } from '@/services/pagespeedHistory';
import { project, otherProject, psiFixture, cruxFixture } from "./fixtures/pagespeedWorkspaceContracts";
const { runPsiMock, queryCruxMock } = vi.hoisted(() => ({ runPsiMock: vi.fn(), queryCruxMock: vi.fn() }));

vi.mock('../src/services/pagespeed', () => ({ runPageSpeedInsights: runPsiMock, queryCrux: queryCruxMock }));

describe('PageSpeed and CrUX workspace', () => {
beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('en');
    useProjectStore.setState({ projects: [project], activeProjectId: project.id });
    runPsiMock.mockReset().mockResolvedValue(psiFixture);
    queryCruxMock.mockReset().mockResolvedValue(cruxFixture);
  });

afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('pl');
  });

it('does not leak a delayed PageSpeed error into a newly selected project', async () => {
    let rejectPsi: ((error: Error) => void) | undefined;
    runPsiMock.mockImplementation(() => new Promise<PageSpeedReport>((_resolve, reject) => { rejectPsi = reject; }));
    useProjectStore.setState({ projects: [project, otherProject], activeProjectId: project.id });
    render(<PageSpeedWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: /Run PageSpeed/ }));
    useProjectStore.setState({ activeProjectId: otherProject.id });
    await waitFor(() => expect(screen.getByLabelText('Page URL')).toHaveProperty('value', 'https://other.example/'));

    rejectPsi?.(new Error('stale PageSpeed failure'));
    await waitFor(() => expect(screen.queryByText('stale PageSpeed failure')).toBeNull());
    expect(screen.getByLabelText('Page URL')).toHaveProperty('value', 'https://other.example/');
  });

it('discards a delayed PageSpeed result after the requested URL changes', async () => {
    let resolvePsi: ((report: PageSpeedReport) => void) | undefined;
    runPsiMock.mockImplementation(() => new Promise<PageSpeedReport>((resolve) => { resolvePsi = resolve; }));
    render(<PageSpeedWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: /Run PageSpeed/ }));
    fireEvent.change(screen.getByLabelText('Page URL'), { target: { value: 'https://example.com/new-page' } });
    resolvePsi?.({ ...psiFixture, requestedUrl: 'https://example.com/' });
    await waitFor(() => expect(screen.getByLabelText('Page URL')).toHaveProperty('value', 'https://example.com/new-page'));
    expect(screen.queryByText('Laboratory data — PageSpeed Insights')).toBeNull();
    expect(screen.getByRole('button', { name: /Run PageSpeed/ })).toHaveProperty('disabled', false);
  });

it('keeps an incomplete CrUX collection period from crashing the workspace', async () => {
    queryCruxMock.mockResolvedValue({ ...cruxFixture, response: { record: { collectionPeriod: { firstDate: { year: 2026 } }, metrics: {} } } });
    render(<PageSpeedWorkspace />);
    fireEvent.click(screen.getByRole('button', { name: /Fetch field data/ }));
    expect(await screen.findByText('Field data — Core Web Vitals')).toBeTruthy();
    expect(screen.getByText('API collection period')).toBeTruthy();
  });

it('keeps boolean p75 unknown instead of classifying it as zero', async () => {
    queryCruxMock.mockResolvedValue({ ...cruxFixture, response: { record: { metrics: { largest_contentful_paint: { percentiles: { p75: false } } } } } });
    render(<PageSpeedWorkspace />);
    fireEvent.click(screen.getByRole('button', { name: /Fetch field data/ }));
    expect(await screen.findByText('No p75 percentile')).toBeTruthy();
    expect(screen.getByText('Unrated')).toBeTruthy();
    expect(screen.queryByText('0 ms')).toBeNull();
  });

it('keeps both history snapshots when PSI and CrUX finish concurrently', async () => {
    let resolvePsi!: (report: PageSpeedReport) => void;
    let resolveCrux!: (report: CruxReport) => void;
    runPsiMock.mockImplementation(() => new Promise((resolve) => { resolvePsi = resolve; }));
    queryCruxMock.mockImplementation(() => new Promise((resolve) => { resolveCrux = resolve; }));
    const { result } = renderHook(() => usePerformanceWorkspace(project.id, project.rootUrl, i18n.t));
    let pending: Promise<void>[] = [];
    act(() => { pending = [result.current.runPsi(), result.current.runCrux()]; });
    await act(async () => { resolvePsi(psiFixture); resolveCrux(cruxFixture); await Promise.all(pending); });
    expect(result.current.history).toHaveLength(2);
    expect(readPageSpeedSnapshots(project.id)).toHaveLength(2);
    expect(result.current.session.pageSpeed).toEqual(psiFixture);
    expect(result.current.session.crux).toEqual(cruxFixture);
  });
});
