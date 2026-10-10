import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { TopicalDiagnosisView } from '@/components/Charts/crawlArchitecture/topicalDiagnosis/TopicalDiagnosisView';
import { verdictText } from '@/components/Charts/crawlArchitecture/topicalDiagnosis/verdictText';
import { buildTopicalDiagnosis } from '@/services/topicalDiagnosis';
import { createCrawlPageFixture } from './fixtures/crawl';

const link = (target_url: string) => ({ target_url, anchor_text: 'x', is_internal: true });
const page = (url: string, patch: Record<string, unknown> = {}) => createCrawlPageFixture({
  url, final_url: url, semantic_language: 'pl', word_count: 800, hreflangs: [], ...patch,
});
const posts = ['a', 'b', 'c', 'd', 'e', 'f'].map((slug) => `https://ex.test/blog/${slug}/`);
const site = () => {
  const hub = page('https://ex.test/blog/', { semantic_links: posts.map(link), word_count: 150, title: 'Blog o LinkedIn | Ex' });
  const terms = [['navigator', 'alerty', 'crm'], ['navigator', 'alerty', 'teams'], ['psychiatria', 'dzieci', 'szpital'], ['psychiatria', 'dzieci', 'oddział'], ['wordpress', 'kraków', 'bilety'], ['kurs', 'online', 'wstyd']];
  const titles = ['Alerty Sales Navigatora', 'Alerty Sales Navigatora w Teams', 'Psychiatria dzieci', 'Psychiatria dzieci na oddziale', 'WordCamp', 'Kursy online'];
  return [hub, ...posts.map((url, index) => page(url, { semantic_terms: terms[index], title: titles[index], semantic_links: index === 0 ? [link(posts[1])] : [] }))];
};

describe('TopicalDiagnosisView', () => {
  beforeEach(async () => { await i18n.changeLanguage('pl'); });
  const report = buildTopicalDiagnosis(site(), 'https://ex.test/blog/');

  it('renders the stats, the verdict filter and the areas with their topics', () => {
    const onShowInGraph = vi.fn();
    render(<TopicalDiagnosisView report={report} onShowInGraph={onShowInGraph} onOpenPage={vi.fn()} />);
    expect(screen.getByText('Diagnoza tematyczna')).toBeTruthy();
    expect(screen.getByText('Dokumenty:').parentElement?.textContent).toContain('7');
    expect(screen.getByRole('button', { name: `Wszystkie · ${report.verdicts.length}` }).getAttribute('aria-pressed')).toBe('true');
    const areas = screen.getByRole('region', { name: 'Obszary i tematy' });
    expect(within(areas).getByText('Blog o LinkedIn')).toBeTruthy();
    expect(within(areas).getByText('alerty sales navigatora')).toBeTruthy();
    fireEvent.click(within(areas).getAllByRole('button', { name: 'Pokaż w grafie' })[0]);
    expect(onShowInGraph).toHaveBeenCalledWith({ kind: 'area', id: report.areas[0].id });
    fireEvent.click(within(areas).getAllByRole('button', { name: 'Pokaż w grafie' })[1]);
    expect(onShowInGraph).toHaveBeenLastCalledWith({ kind: 'topic', id: report.topics[0].id });
  });

  it('filters verdicts by severity and opens a page from a verdict', () => {
    const onOpenPage = vi.fn();
    render(<TopicalDiagnosisView report={report} onShowInGraph={vi.fn()} onOpenPage={onOpenPage} />);
    const fixCount = report.verdicts.filter((verdict) => verdict.severity === 'fix').length;
    const weakCount = report.verdicts.filter((verdict) => verdict.severity === 'weak').length;
    expect(fixCount).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: `Słabo · ${weakCount}` }));
    expect(screen.queryByText('Brak linku do huba')).toBeNull();
    expect(screen.getAllByText('Cienki temat').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: `Do poprawy · ${fixCount}` }));
    expect(screen.getAllByText('Brak linku do huba')).toHaveLength(fixCount);
    fireEvent.click(screen.getAllByRole('button', { name: '/blog/b/' })[0]);
    expect(onOpenPage).toHaveBeenCalledWith(posts[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Dobrze · 0' }));
    expect(screen.getByText('Brak werdyktów w tej grupie.')).toBeTruthy();
  });

  it('shows the no-terms and truncation notices', () => {
    const empty = buildTopicalDiagnosis([], 'https://ex.test/');
    render(<TopicalDiagnosisView report={{ ...empty, truncated: true }} onShowInGraph={vi.fn()} onOpenPage={vi.fn()} />);
    expect(screen.getByRole('status').textContent).toContain('nie ma terminów treści');
    expect(screen.getByText(/ograniczona do 500 stron/)).toBeTruthy();
  });

  it('builds localized copy from the verdict keys and measured parameters', () => {
    const translate = (key: string, values?: Record<string, unknown>) => String(i18n.t(key, values as Record<string, unknown>));
    const backlink = report.verdicts.find((verdict) => verdict.code === 'hub-missing-backlink')!;
    expect(verdictText(translate, backlink)).toMatchObject({
      title: 'Brak linku do huba', severity: 'Do poprawy', scope: 'dokument', evidence: ['hub: https://ex.test/blog/'],
    });
    expect(verdictText(translate, backlink).action).toContain('https://ex.test/blog/');
    const isolated = report.verdicts.find((verdict) => verdict.code === 'document-isolated')!;
    expect(verdictText(translate, isolated).action).toBe('Nie ma tematu i linkują do niej tylko listy. Podlinkuj ją z pokrewnego artykułu.');
  });
});
