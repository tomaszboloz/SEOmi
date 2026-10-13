import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import i18n from '@/i18n';
import { filterAuditImages } from '@/components/Results/images/imagePolicy';
import { OverviewContentAnalysis } from '@/components/Results/overview/OverviewContentAnalysis';
import { MetadataAccessibilityFindings } from '@/components/Results/metadata/MetadataAccessibilityFindings';
import { DataForSeoSummaryCard } from '@/components/Results/dataforseoAudit/DataForSeoSummaryCard';
import { useAuditStore } from '@/stores/auditStore';
import type { PageAuditData } from '@/types';
import { createAuditFixture } from './fixtures/audit';

vi.mock('@/components/Results/ShowOnPageButton', () => ({
  ShowOnPageButton: (p: { url: string; domIndex: number }) => <i data-testid="show" data-url={p.url} data-index={p.domIndex} />,
}));

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('filterAuditImages search', () => {
  it('matches against the source when an image has no alt text or format', () => {
    const images = [{ src: 'https://x.test/hero.png' }, { src: 'https://x.test/other.png', alt: 'Hero banner' }] as never;
    expect(filterAuditImages(images, 'all', 'hero', false).map((image: { src: string }) => image.src)).toEqual(['https://x.test/hero.png', 'https://x.test/other.png']);
    expect(filterAuditImages(images, 'all', 'banner', false)).toHaveLength(1);
    expect(filterAuditImages(images, 'all', 'zzz', false)).toHaveLength(0);
  });
});

describe('OverviewContentAnalysis', () => {
  const withStats = (stats: Record<string, unknown>): PageAuditData => {
    const base = createAuditFixture();
    return { ...base, content_stats: { ...base.content_stats, ...stats } } as PageAuditData;
  };

  it('styles complex content as a warning, shows the readability formula and omits missing density', () => {
    const { container } = render(<OverviewContentAnalysis audit={withStats({
      word_count: 120, complexity_label: 'complex', readability_method: 'flesch-pl',
      top_keywords: [{ keyword: 'alpha', count: 3 }, { keyword: 'beta', count: 2, density_percent: 1.5 }],
    })} />);
    expect(container.querySelector('.text-rose-300')).not.toBeNull();
    expect(container.textContent).toContain('flesch-pl');
    expect(container.textContent).toContain('2 · 1.50%');
    expect(container.textContent).not.toMatch(/3 · /);
  });

  it('leaves out the formula when no readability method was recorded', () => {
    const { container } = render(<OverviewContentAnalysis audit={withStats({ word_count: 120, complexity_label: 'simple', readability_method: undefined, top_keywords: [] })} />);
    expect(container.textContent).not.toContain('flesch-pl');
  });
});

describe('MetadataAccessibilityFindings evidence fallbacks', () => {
  it('defaults a missing column to 1 and falls back to the request URL without a final URL', () => {
    const audit = {
      url: 'https://u.test/', final_url: '',
      accessibility: { findings: [{ code: 'accessibility-duplicate-id', severity: 'warning', message: 'Found 1', evidence: 'ev', recommendation: 'rec', elements: [{ dom_position: 1, dom_query: '#a', html_snippet: '<i id=a>', line: 7 }] }] },
    } as unknown as PageAuditData;
    render(<MetadataAccessibilityFindings audit={audit} />);
    expect(screen.getByText(/7:1/)).toBeTruthy();
    expect(screen.getByTestId('show').getAttribute('data-url')).toBe('https://u.test/');
  });
});

describe('DataForSeoSummaryCard', () => {
  it('celebrates a profile with zero broken backlinks', () => {
    useAuditStore.setState({ dataforseoData: { total_backlinks: 100, referring_domains: 50, dofollow_backlinks: 80, rank: 60, broken_backlinks: 0 } } as never);
    render(<DataForSeoSummaryCard />);
    expect(screen.getByText(new RegExp(i18n.t('dataforseo.noBrokenLinks')))).toBeTruthy();
    act(() => { useAuditStore.setState({ dataforseoData: null }); });
  });
});
