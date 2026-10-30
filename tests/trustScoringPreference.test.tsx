import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { CrawlTrustTab } from '@/components/Domain/crawlResults/trust/CrawlTrustTab';
import { crawlTrustSummary, persistCompletedTrustRun, readScoringProfile, readTrustHistory, saveScoringProfile, scoringProfileKey } from '@/services/eeatTrust';
import { START, diabetesPages, trustedArticle } from './eeatTrustFixtures';
import { createCrawlRunFixture } from './fixtures/crawl';

vi.mock('@/services/monitoringAlerts', () => ({ monitorScoreDrop: vi.fn().mockResolvedValue({}) }));

const pages = diabetesPages().map((page) => (page.url.includes('/articles/') ? trustedArticle(page) : page));
const run = (id: string, projectId = 'pref-project') => createCrawlRunFixture({
  id, projectId, startUrl: START, completedAt: '2026-10-20T00:00:00Z',
  result: { ...createCrawlRunFixture().result, start_url: START, pages, pages_crawled: pages.length },
});
const toggle = () => screen.getByRole('checkbox', { name: i18n.t('trust.scoring.label') }) as HTMLInputElement;

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage('en');
});

describe('scoring profile preference (#65, #87, #88)', () => {
  it('defaults to legacy and ignores unusable projects or stored garbage', () => {
    expect(readScoringProfile('pref-project')).toBe('legacy');
    expect(readScoringProfile(null)).toBe('legacy');
    localStorage.setItem(scoringProfileKey('pref-project'), '"weights-of-my-own"');
    expect(readScoringProfile('pref-project')).toBe('legacy');
    localStorage.setItem(scoringProfileKey('pref-project'), '{broken');
    expect(readScoringProfile('pref-project')).toBe('legacy');
    expect(saveScoringProfile(null, 'claim-backed-v1')).toBe(false);
    expect(saveScoringProfile('bad id!', 'claim-backed-v1')).toBe(false);
    expect(saveScoringProfile('pref-project', 'claim-backed-v1')).toBe(true);
    expect(readScoringProfile('pref-project')).toBe('claim-backed-v1');
  });

  it('applies the stored profile to completed-run history and the PDF digest', () => {
    saveScoringProfile('pref-project', 'claim-backed-v1');
    const result = persistCompletedTrustRun('pref-project', run('r1'));
    expect(result?.report.scoringProfile).toBe('claim-backed-v1');
    expect(readTrustHistory('pref-project')[0].scoringProfile).toBe('claim-backed-v1');
    expect(crawlTrustSummary(run('r1'))?.scoring_profile).toBe('claim-backed-v1');
    expect(crawlTrustSummary(run('r1', 'other-project'))?.scoring_profile).toBe('legacy');
  });
});

describe('TrustScoringToggle in the Trust tab', () => {
  it('is an unchecked, described checkbox by default', () => {
    render(<CrawlTrustTab pages={pages} startUrl={START} run={run('r1')} projectId="pref-project" />);
    expect(toggle().checked).toBe(false);
    expect(toggle().getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByText(i18n.t('trust.scoring.hint'))).toBeTruthy();
  });

  it('stores the opt-in per project, rescores the run and survives a remount', () => {
    const view = render(<CrawlTrustTab pages={pages} startUrl={START} run={run('r1')} projectId="pref-project" />);
    fireEvent.click(toggle());
    expect(toggle().checked).toBe(true);
    expect(readScoringProfile('pref-project')).toBe('claim-backed-v1');
    expect(readTrustHistory('pref-project').at(-1)?.scoringProfile).toBe('claim-backed-v1');
    view.unmount();
    const again = render(<CrawlTrustTab pages={pages} startUrl={START} run={run('r1')} projectId="pref-project" />);
    expect(toggle().checked).toBe(true);
    again.rerender(<CrawlTrustTab pages={pages} startUrl={START} run={run('r2', 'other-project')} projectId="other-project" />);
    expect(toggle().checked).toBe(false);
    fireEvent.click(toggle());
    fireEvent.click(toggle());
    expect(readScoringProfile('other-project')).toBe('legacy');
    expect(readTrustHistory('other-project').at(-1)?.scoringProfile).toBeUndefined();
  });
});
