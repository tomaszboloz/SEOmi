import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AmpFindingItem } from '@/components/Results/ampAudit/AmpFindingItem';
import { ProjectGateList } from '@/components/Projects/gate/ProjectGateList';
import { PageSpeedLabScores } from '@/components/Performance/pagespeed/PageSpeedLabScores';
import { PageSpeedHistoryCharts } from '@/components/Performance/pagespeed/PageSpeedHistoryCharts';
import { useProjectStore } from '@/stores/projectStore';
import type { AmpFinding } from '@/types';

describe('unreferenced components batch 3 direct assertions', () => {
  it('AmpFindingItem renders finding severity and message', () => {
    const finding: AmpFinding = {
      severity: 'warning',
      code: 'MANDATORY_TAG_MISSING',
      message: 'The mandatory tag is missing.',
      evidence: '<amp-img> without width',
      spec_url: 'https://amp.dev',
    } as any;
    const t = ((k: string) => k) as any;

    render(<AmpFindingItem finding={finding} t={t} />);
    expect(screen.getByText('ampUi.severity.warning')).toBeTruthy();
    expect(screen.getByText('The mandatory tag is missing.')).toBeTruthy();
    expect(screen.getByText('<amp-img> without width')).toBeTruthy();
  });

  it('ProjectGateList renders project choose screen or empty fallback', () => {
    useProjectStore.setState({
      projects: [
        { id: 'proj-1', name: 'Project 1', rootUrl: 'https://p1.com' } as any,
        { id: 'proj-2', name: 'Project 2', rootUrl: '' } as any,
      ],
    });
    render(<ProjectGateList />);
    expect(screen.getByRole('button', { name: /Project 1/ }).textContent).toContain('https://p1.com');
    const btn = screen.getByRole('button', { name: /Project 1/ });
    fireEvent.click(btn);
    expect(useProjectStore.getState().activeProjectId).toBe('proj-1');
  });

  it('PageSpeedLabScores renders 4 category scores', () => {
    const psiReport = {
      categories: {
        performance: 95,
        accessibility: 88,
        bestPractices: 100,
        seo: 92,
      },
      metrics: {},
    };

    render(<PageSpeedLabScores psiReport={psiReport} />);
    expect(screen.getByText('95')).toBeDefined();
    expect(screen.getByText('88')).toBeDefined();
    expect(screen.getByText('100')).toBeDefined();
    expect(screen.getByText('92')).toBeDefined();
  });

  it('PageSpeedHistoryCharts renders category cards and endpoint values', () => {
    const { container } = render(
      <PageSpeedHistoryCharts
        chronologicalHistory={[{ pageSpeed: { categories: { performance: 70, accessibility: 80, bestPractices: 90, seo: 60 } } } as any]}
        latestSnapshot={{ pageSpeed: { categories: { performance: 95, accessibility: 88, bestPractices: 100, seo: 92 } } } as any}
      />,
    );
    expect(container.querySelectorAll('article')).toHaveLength(4);
    expect(container.textContent).toContain('1 points');
    expect(container.textContent).toContain('70');
    expect(container.textContent).toContain('95');
  });
});
