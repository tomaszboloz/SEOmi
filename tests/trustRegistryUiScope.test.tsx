import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { CrawlTrustTab } from '@/components/Domain/crawlResults/trust/CrawlTrustTab';
import type { ProfileEvidence, RegistryResult } from '@/services/eeatTrust';
import { START, diabetesPages, trustedArticle } from './eeatTrustFixtures';
import { createCrawlRunFixture } from './fixtures/crawl';

const nativeRegistryFetcher = vi.hoisted(() => vi.fn());
const verifyProfile = vi.hoisted(() => vi.fn());

vi.mock('@/services/eeatTrust/registry', async (importActual) => ({
  ...(await importActual<typeof import('@/services/eeatTrust/registry')>()), nativeRegistryFetcher, verifyProfile,
}));

const pages = [trustedArticle(diabetesPages()[2])];
const profile: ProfileEvidence = {
  url: 'https://orcid.org/0000-0000-0000-0001', kind: 'orcid', status: 'syntax-valid', tier: 1, id: '0000-0000-0000-0001',
};
const fetched: ProfileEvidence = { ...profile, status: 'fetched', fetchedAt: '2026-10-27T00:00:00Z', expiresAt: '2026-10-28T00:00:00Z' };
const result: RegistryResult = { profile: fetched, stale: false };
const run = (id: string) => createCrawlRunFixture({ id, startUrl: START, result: { ...createCrawlRunFixture().result, pages, pages_crawled: pages.length } });

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage('en');
  nativeRegistryFetcher.mockReset();
  verifyProfile.mockReset();
});

describe('CrawlTrustTab registry verification scope', () => {
  it('passes native registry I/O and the active project/run, then renders fetched evidence', async () => {
    verifyProfile.mockResolvedValue(result);
    render(<CrawlTrustTab pages={pages} startUrl={START} run={run('registry-run')} projectId="registry-project" />);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('trust.entities.verifyProfiles') }));
    await waitFor(() => expect(verifyProfile).toHaveBeenCalledTimes(1));
    expect(verifyProfile).toHaveBeenCalledWith(
      expect.objectContaining({ url: profile.url, kind: 'orcid', status: 'syntax-valid' }),
      expect.objectContaining({ fetcher: nativeRegistryFetcher, projectId: 'registry-project', runId: 'registry-run' }),
    );
    await waitFor(() => expect(screen.getByText(new RegExp(`orcid: fetched.*${profile.url}`))).toBeTruthy());
  });

  it('drops late evidence after run/project switch and after unmount', async () => {
    let resolve: (value: RegistryResult) => void = () => undefined;
    verifyProfile.mockImplementation(() => new Promise<RegistryResult>((done) => { resolve = done; }));
    const view = render(<CrawlTrustTab pages={pages} startUrl={START} run={run('old-run')} projectId="old-project" />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('trust.entities.verifyProfiles') }));
    await waitFor(() => expect(verifyProfile).toHaveBeenCalledTimes(1));
    view.rerender(<CrawlTrustTab pages={pages} startUrl={START} run={run('new-run')} projectId="new-project" />);
    await act(async () => resolve(result));
    await waitFor(() => expect(screen.queryByText(new RegExp(`orcid: fetched.*${profile.url}`))).toBeNull());
    view.unmount();

    const unmounted = render(<CrawlTrustTab pages={pages} startUrl={START} run={run('unmounted-run')} projectId="unmounted-project" />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('trust.entities.verifyProfiles') }));
    await waitFor(() => expect(verifyProfile).toHaveBeenCalledTimes(2));
    unmounted.unmount();
    const storage = JSON.stringify(localStorage);
    await act(async () => resolve(result));
    expect(JSON.stringify(localStorage)).toBe(storage);
  });
});
