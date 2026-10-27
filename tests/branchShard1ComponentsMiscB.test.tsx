import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { PageSpeedLabScores } from '@/components/Performance/pagespeed/PageSpeedLabScores';
import { AmpAuditView } from '@/components/Results/AmpAuditView';
import { HeadingsKeyphraseSection } from '@/components/Results/headingsTree/HeadingsKeyphraseSection';
import { LinkCard } from '@/components/Results/links/LinkCard';
import { PerformanceHttpSection } from '@/components/Results/performanceMetrics/PerformanceHttpSection';
import { SocialGoogleSerp } from '@/components/Results/social/SocialGoogleSerp';
import { useDomainAgeLookup } from '@/components/SeoTools/workspace/useDomainAgeLookup';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import type { LinkData, PageAuditData } from '@/types';
import { createAuditFixture } from './fixtures/audit';
import { backupDocument, backupInputEvent, settingsBackupHook } from './fixtures/settingsBackupHook';
import { deferred } from './fixtures/gscSliceDirect';

vi.mock('@/components/Results/ShowOnPageButton', () => ({ ShowOnPageButton: () => null }));

const t = i18n.t.bind(i18n) as never;

beforeEach(async () => { await i18n.changeLanguage('en'); });

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('PageSpeed lab scores with missing categories', () => {
  it('renders a dash and an empty bar for a null category score', () => {
    const report = { categories: { performance: null, accessibility: 90, bestPractices: 80, seo: 70 }, metrics: {} };
    const { container } = render(<PageSpeedLabScores psiReport={report} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect((container.querySelector('div.h-full') as HTMLElement).style.width).toBe('0%');
  });
});

describe('AMP audit view states', () => {
  const baseAudit = (amp: unknown): PageAuditData => createAuditFixture({ amp } as Partial<PageAuditData>);
  beforeEach(() => useAuditStore.setState({ showOnlyProblems: false }));

  it('explains that no AMP document was detected', () => {
    render(<AmpAuditView audit={baseAudit({ detected: false, is_amp_document: false, amphtml_urls: [], coverage: 'partial-local-rules', findings: [], unchecked: [] })} />);
    expect(screen.getByText(i18n.t('ampUi.notDetected'))).toBeTruthy();
  });

  it('tolerates a legacy report without a findings list', () => {
    render(<AmpAuditView audit={baseAudit({ detected: true, is_amp_document: true, amphtml_urls: [], coverage: 'partial-local-rules', unchecked: [] })} />);
    expect(screen.queryByText(i18n.t('ampUi.notDetected'))).toBeNull();
  });
});

describe('headings keyphrase truncation notice', () => {
  it('warns when the analyzed body text was truncated', () => {
    const audit = createAuditFixture({ content_stats: { word_count: 5, reading_time_minutes: 1, text_ratio_percent: 5, top_keywords: [], body_text_truncated: true } } as Partial<PageAuditData>);
    render(<HeadingsKeyphraseSection audit={audit} keyphrase="seo" setKeyphrase={vi.fn()} savedKeyphraseKey={null} />);
    expect(screen.getByText(i18n.t('legacyUi.headings.truncated'))).toBeTruthy();
  });
});

describe('link card mixed content', () => {
  it('flags an http link on an https page', () => {
    const link = { href: 'http://other.test/a', text: 'a', is_internal: false } as LinkData;
    render(<LinkCard link={link} pageUrl="https://site.test/" isPageHttps copiedUrl={null} handleCopy={vi.fn()} handleVerifySingleLink={vi.fn()} />);
    expect(screen.getByText(i18n.t('legacyUi.links.mixedContent'))).toBeTruthy();
  });
});

describe('HTTP performance measurement time', () => {
  const performance = (measured_at: string | undefined) => ({
    method: 'GET', scope: 'document', response_headers_ms: 1, body_read_ms: 2, total_request_ms: 3, decoded_body_bytes: 10, content_length_header_bytes: null,
    redirect_hops: 0, measured_at,
  }) as unknown as NonNullable<PageAuditData['http_performance']>;

  it.each([[undefined], ['not a date']])('shows a dash for measured_at=%s', (measuredAt) => {
    render(<PerformanceHttpSection httpPerformance={performance(measuredAt)} t={t} />);
    expect(screen.getByText(`${i18n.t('performance.measuredAt')}: —`)).toBeTruthy();
  });
});

describe('Google SERP preview favicon', () => {
  it('renders the page favicon when one was observed', () => {
    const audit = createAuditFixture({ technical: { hreflang_tags: [], favicon: 'https://site.test/favicon.ico' } } as Partial<PageAuditData>);
    const { container } = render(
      <SocialGoogleSerp
        serpMode="desktop" setSerpMode={vi.fn()} audit={audit} siteName="Site" displayUrl="site.test" visibleTitle="Title" visibleDescription="Desc"
        liveQuery="" liveTitle="Title" liveDesc="Desc" estimatedPixelWidth={100} sitelinkCandidates={[]} richResultPreview={null}
      />,
    );
    expect(container.querySelector('img[src="https://site.test/favicon.ico"]')).toBeTruthy();
  });
});

describe('domain age lookup for an unknown project', () => {
  it('starts with an empty domain when the active project is not in the store', () => {
    useProjectStore.setState({ activeProjectId: 'ghost-project', projects: [] });
    const view = renderHook(() => useDomainAgeLookup());
    expect(view.result.current.domain).toBe('');
  });
});

describe('settings backup import credential loading', () => {
  it('does not report a restored backup when the project changed while credentials loaded', async () => {
    const f = settingsBackupHook();
    const credentials = deferred<void>();
    f.loadDataForSeo.mockReturnValueOnce(credentials.promise);
    let pending!: Promise<void>;
    await act(async () => { pending = f.result.current.handleImportProject(backupInputEvent(async () => JSON.stringify(backupDocument()))); });
    act(() => useProjectStore.getState().selectProject('two'));
    await act(async () => { credentials.resolve(); await pending; });
    expect(f.result.current.backupStatus).toBeNull();
  });
});
