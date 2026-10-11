import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import type { TFunction } from 'i18next';
import type { DomainOverviewData, ImageData, PageAuditData, SavedKeywordItem } from '@/types';
import { DomainCompetitors } from '@/components/Domain/domainOverview/DomainCompetitors';
import { CrawlResumePanel } from '@/components/Domain/siteAudit/CrawlResumePanel';
import { useCrawlErrorFilters } from '@/components/Domain/siteAudit/session/useCrawlErrorFilters';
import { SavedKeywordsTableRow } from '@/components/Keywords/savedKeywords/SavedKeywordsTableRow';
import { SidebarNavItem } from '@/components/Layout/sidebar/SidebarNavItem';
import { ImageBadges } from '@/components/Results/images/ImageBadges';
import { MetadataFavicons } from '@/components/Results/metadata/MetadataFavicons';
import { SecurityDisclosureCards } from '@/components/Results/securityHeaders/SecurityDisclosureCards';
import { StructuredDataView } from '@/components/Results/StructuredDataView';
import { MonitoringAlertsPanel } from '@/components/Settings/MonitoringAlertsPanel';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import { createAuditFixture } from './fixtures/audit';

const t = i18n.t.bind(i18n) as unknown as TFunction;

describe('DomainCompetitors', () => {
  it('shows dashes for missing overlap and position metrics', () => {
    const overview = { competitors: [{ domain: 'rival.test' }] } as unknown as DomainOverviewData;
    render(<DomainCompetitors overview={overview} t={t} />);
    expect(screen.getByText(`— ${t('domainResearchUi.overlappingKeywords')}`)).toBeTruthy();
    expect(screen.getByText('—', { selector: 'span.font-mono' })).toBeTruthy();
  });
});

describe('CrawlResumePanel', () => {
  it('passes empty progress counts when the interrupted crawl has no recorded URLs', () => {
    const calls: Array<Record<string, unknown>> = [];
    const session = {
      interruptedCrawl: { url: 'https://a.test/', limit: 10, startedAt: '2026-10-01T00:00:00Z' },
      discardInterruptedCrawl: vi.fn(), resumeInterruptedCrawl: vi.fn(),
      t: (key: string, params?: Record<string, unknown>) => { if (params) calls.push(params); return key; },
    } as unknown as Parameters<typeof CrawlResumePanel>[0]['session'];
    render(<CrawlResumePanel session={session} />);
    expect(calls[0]).toMatchObject({ completed: '', frontier: '' });
  });
});

describe('useCrawlErrorFilters without seed URLs', () => {
  it('previews only the typed URL when the crawl config has no seedUrls', async () => {
    const invoke = vi.fn().mockResolvedValue({ valid: true });
    useToolsStore.setState({ crawlResult: null, crawlConfig: { ...useToolsStore.getState().crawlConfig, seedUrls: undefined } });
    const { result } = renderHook(() => useCrawlErrorFilters('https://x.test/', 'proj', { invoke } as never));
    await act(async () => { await result.current.validateFilters(); });
    expect(invoke).toHaveBeenCalledWith('validate_crawl_filters', expect.objectContaining({ previewUrls: ['https://x.test/'] }));
  });
});

describe('SavedKeywordsTableRow with unobserved metrics', () => {
  it('renders dashes for missing volume, difficulty and CPC', () => {
    const item: SavedKeywordItem = { id: 'k1', keyword: 'seo', search_volume: null, difficulty: null, cpc: null, intent: 'Informational', tags: [], addedAt: '2026-10-01T00:00:00Z' };
    render(<table><tbody><SavedKeywordsTableRow item={item} newTagInput={null} setNewTagInput={vi.fn()} onAddTag={vi.fn()} onRemoveTag={vi.fn()} onDeleteKeyword={vi.fn()} intentLabel={(v) => v} t={t} /></tbody></table>);
    expect(screen.getAllByText('—')).toHaveLength(3);
  });
});

describe('SidebarNavItem', () => {
  const Icon = () => <svg />;
  it('does nothing on click for an item with neither id nor action, and styles an active badge', () => {
    const setActiveTab = vi.fn();
    const { rerender } = render(<SidebarNavItem item={{ labelKey: 'nav.x', icon: Icon } as never} itemIndex={0} sidebarCollapsed={false} activeTab={'overview' as never} setActiveTab={setActiveTab} />);
    fireEvent.click(screen.getByRole('button'));
    expect(setActiveTab).not.toHaveBeenCalled();
    rerender(<SidebarNavItem item={{ id: 'links', labelKey: 'nav.x', icon: Icon, badge: () => 7 } as never} itemIndex={0} sidebarCollapsed={false} activeTab={'links' as never} setActiveTab={setActiveTab} />);
    expect(screen.getByText('7').className).toContain('text-emerald-300');
    expect(screen.getByRole('button').getAttribute('aria-current')).toBe('page');
  });
});

describe('ImageBadges', () => {
  it('falls back to a generic IMG label when the source has no extension', () => {
    const img = { src: '/photo.?v=1', alt: '', has_alt: false, lazy_loaded: false } as unknown as ImageData;
    render(<ImageBadges img={img} />);
    expect(screen.getByText((content) => content.trim().startsWith('IMG'))).toBeTruthy();
  });
});

describe('MetadataFavicons', () => {
  it('uses the inferred format and the unknown-size label when declarations are missing', () => {
    const audit = createAuditFixture({ technical: { hreflang_tags: [], favicons: [{ rel: 'icon', href: '/f.ico', inferred_format: 'ico' }] } } as Partial<PageAuditData>);
    render(<MetadataFavicons audit={audit} />);
    expect(screen.getByText('ico')).toBeTruthy();
    expect(screen.getByText(i18n.t('legacyUi.metadata.unknownSize'))).toBeTruthy();
  });

  it('uses the unknown-type label when neither declared nor inferred type exists', () => {
    const audit = createAuditFixture({ technical: { hreflang_tags: [], favicons: [{ rel: 'icon', href: '/f' }] } } as Partial<PageAuditData>);
    render(<MetadataFavicons audit={audit} />);
    expect(screen.getByText(i18n.t('legacyUi.metadata.unknownType'))).toBeTruthy();
  });
});

describe('SecurityDisclosureCards', () => {
  it('marks a server banner without a version as hardened', () => {
    render(<SecurityDisclosureCards serverHeader="nginx" xPoweredBy={undefined} t={t} />);
    expect(screen.getByText(i18n.t('legacyUi.security.bannerHardened'))).toBeTruthy();
    expect(screen.queryByText(i18n.t('legacyUi.security.versionLeaked'))).toBeNull();
  });
});

describe('StructuredDataView severities', () => {
  it('styles an error-severity validation finding as an error', () => {
    const item = {
      format: 'JSON-LD', data_type: 'Article', content: { '@type': 'Article' },
      validation_issues: [{ code: 'broken-json', severity: 'error' as const, message: 'Broken.', path: '$', recommendation: 'Fix it.' }],
    };
    render(<StructuredDataView audit={createAuditFixture({ structured_data: [item] })} />);
    const finding = screen.getByText('Broken.').closest('div') as HTMLElement;
    expect(finding.className).toContain('text-rose-200');
  });
});

describe('MonitoringAlertsPanel controls', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    localStorage.clear();
    act(() => useProjectStore.setState({ projects: [], activeProjectId: 'p-mon' }));
  });

  it('persists the enable switch, per-type toggles and every threshold', async () => {
    await act(async () => { render(<MonitoringAlertsPanel />); });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable change monitoring alerts' }));
    fireEvent.click(screen.getByRole('checkbox', { name: i18n.t('monitoringUi.enableType', { type: i18n.t('monitoringUi.types.crawl') }) }));
    const number = (name: string, value: string) => fireEvent.change(screen.getByRole('spinbutton', { name }), { target: { value } });
    number(i18n.t('monitoringUi.gscMinimum'), '77');
    number(i18n.t('monitoringUi.psiDrop'), '0.3');
    number(i18n.t('monitoringUi.crawlChanged'), '9');
    number(i18n.t('monitoringUi.semanticChanged'), '4');
    const saved = JSON.parse(localStorage.getItem('seomi_project_p-mon_monitoring_alert_settings_v1') || '{}');
    expect(saved.enabled).toBe(true);
    expect(saved.types.crawl).toBe(false);
    expect(saved.thresholds).toMatchObject({ gsc: { minImpressions: 77 }, pagespeed: { categoryDrop: 0.3 }, crawl: { changedPages: 9 }, semantic: { changes: 4 } });
  });
});
