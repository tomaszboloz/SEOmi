import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompetitorKeywordsPanel } from '@/components/SeoTools/workspace/CompetitorKeywordsPanel';
import { competitorKeywordsInputStorageKey } from '@/components/SeoTools/workspace/seoToolsTypes';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import i18n from '@/i18n';

vi.mock('@/components/DataForSEO/cost/DataForSeoCostMeter', () => ({ DataForSeoCostMeter: () => null }));

const analyzeDomain = vi.fn();
const project = (rootUrl?: string) => ({ id: 'p1', name: 'P', rootUrl, createdAt: 'x', lastOpenedAt: 'x' });
const overview = (domain: string, top_keywords: unknown[]) => ({ domain, top_keywords });
const input = () => screen.getByLabelText(i18n.t('seoTools.competitorDomain')) as HTMLInputElement;
const tt = (k: string) => i18n.t(`seoTools.${k}`);

describe('CompetitorKeywordsPanel', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    localStorage.clear();
    analyzeDomain.mockReset();
    useProjectStore.setState({ projects: [project('https://root.test')], activeProjectId: 'p1' });
    useToolsStore.setState({ domainOverview: null, domainError: null, isDomainLoading: false, analyzeDomain } as never);
  });

  it('starts with the project root URL and submits the domain for analysis', () => {
    render(<CompetitorKeywordsPanel />);
    expect(input().value).toBe('https://root.test');
    fireEvent.change(input(), { target: { value: 'rival.test' } });
    fireEvent.click(screen.getByRole('button', { name: tt('loadKeywords') }));
    expect(analyzeDomain).toHaveBeenCalledWith('rival.test');
    expect(localStorage.getItem(competitorKeywordsInputStorageKey('p1'))).toBe('rival.test');
  });

  it('prefers the stored per-project input over the root URL', () => {
    localStorage.setItem(competitorKeywordsInputStorageKey('p1'), 'saved.test');
    render(<CompetitorKeywordsPanel />);
    expect(input().value).toBe('saved.test');
  });

  it('falls back to an empty input without root URL or project, and does not persist then', () => {
    useProjectStore.setState({ projects: [project(undefined)] });
    const { unmount } = render(<CompetitorKeywordsPanel />);
    expect(input().value).toBe('');
    unmount();
    useProjectStore.setState({ activeProjectId: null });
    render(<CompetitorKeywordsPanel />);
    fireEvent.change(input(), { target: { value: 'x.test' } });
    expect(localStorage.length).toBe(0);
  });

  it('disables submit for blank input and while loading', () => {
    useProjectStore.setState({ projects: [project(undefined)] });
    const { unmount } = render(<CompetitorKeywordsPanel />);
    expect((screen.getByRole('button', { name: tt('loadKeywords') }) as HTMLButtonElement).disabled).toBe(true);
    unmount();
    useToolsStore.setState({ isDomainLoading: true } as never);
    render(<CompetitorKeywordsPanel />);
    expect((screen.getByRole('button', { name: tt('loading') }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText(tt('noKeywords'))).toBeNull();
  });

  it('shows the empty message, then an error alert instead of it', () => {
    const { unmount } = render(<CompetitorKeywordsPanel />);
    expect(screen.getByText(tt('noKeywords'))).toBeTruthy();
    unmount();
    useToolsStore.setState({ domainError: 'quota exceeded' } as never);
    render(<CompetitorKeywordsPanel />);
    expect(screen.getByRole('alert').textContent).toBe('quota exceeded');
    expect(screen.queryByText(tt('noKeywords'))).toBeNull();
  });

  it('lists keywords when the overview matches the normalized input domain', () => {
    useToolsStore.setState({
      domainOverview: overview('rival.test', [
        { keyword: 'alpha', position: 3, search_volume: 900, intent: 'commercial' },
        { keyword: 'beta', position: null, search_volume: null, intent: '' },
      ]),
    } as never);
    render(<CompetitorKeywordsPanel />);
    fireEvent.change(input(), { target: { value: ' HTTPS://rival.test/some/path ' } });
    expect(screen.getByText('alpha')).toBeTruthy();
    expect(screen.getByText('900')).toBeTruthy();
    expect(screen.getByText('commercial')).toBeTruthy();
    expect(screen.getAllByText(tt('notAvailable'))).toHaveLength(3);
    expect(screen.queryByText(tt('noKeywords'))).toBeNull();
  });

  it('hides keywords that belong to a different domain', () => {
    useToolsStore.setState({ domainOverview: overview('other.test', [{ keyword: 'alpha', position: 1 }]) } as never);
    render(<CompetitorKeywordsPanel />);
    fireEvent.change(input(), { target: { value: 'rival.test' } });
    expect(screen.queryByText('alpha')).toBeNull();
    expect(screen.getByText(tt('noKeywords'))).toBeTruthy();
  });
});
