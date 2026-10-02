import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CrawlArchitectureHeader } from '@/components/Charts/crawlArchitecture/CrawlArchitectureHeader';
import { CrawlArchitectureBottomNav } from '@/components/Charts/crawlArchitecture/CrawlArchitectureBottomNav';
import { OverviewScoreGauge } from '@/components/Results/overview/OverviewScoreGauge';
import { OverviewIssuesSummary } from '@/components/Results/overview/OverviewIssuesSummary';
import { auditFixture } from './fixtures/workspaceRoutesContracts';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('crawler and summary layout regression #19', () => {
  it('keeps the graph header in document flow while retaining reachable views', () => {
    const setActiveView = vi.fn();
    const { container } = render(<CrawlArchitectureHeader activeView="directory" setActiveView={setActiveView} mapTabsRef={createRef()} />);
    expect(container.firstElementChild?.classList.contains('sticky')).toBe(false);
    fireEvent.click(screen.getAllByRole('tab')[1]);
    expect(setActiveView).toHaveBeenCalledTimes(1);
  });

  it('places the only graph dock above the footer and uses an opaque surface', () => {
    render(<CrawlArchitectureBottomNav activeView="directory" setActiveView={vi.fn()} bottomMapTabsRef={createRef()} />);
    const bottom = screen.getByTestId('crawl-map-bottom-navigation').style.bottom;
    expect(bottom).toContain('calc(2.75rem + env(');
    expect(bottom).toContain('safe-area-inset-bottom');
    expect(screen.getByRole('navigation').classList.contains('bg-slate-950')).toBe(true);
  });

  it('allows translated health labels to shrink inside the gauge card', () => {
    render(<OverviewScoreGauge audit={auditFixture} criticalCount={1} />);
    const label = screen.getByText('overview.healthScore');
    expect(label.parentElement?.classList.contains('min-w-0')).toBe(true);
  });

  it('allows each translated issue counter to wrap inside its own cell', () => {
    render(<OverviewIssuesSummary criticalIssues={[]} warnings={[]} infoIssues={[]} totalIssuesCount={0} />);
    for (const key of ['critical', 'warnings', 'info']) {
      const label = screen.getByText(`legacyUi.overview.${key}`);
      expect(label.parentElement?.classList.contains('min-w-0')).toBe(true);
      expect(label.classList.contains('[overflow-wrap:anywhere]')).toBe(true);
    }
  });
});
