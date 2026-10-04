import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import i18n from '@/i18n';
import { CrawlPageDiscoveryCell } from '@/components/Domain/crawlResults/pageTable/CrawlPageDiscoveryCell';
import { CrawlPageEvidenceDetails } from '@/components/Domain/crawlResults/pageTable/CrawlPageEvidenceDetails';
import { createCrawlPageFixture } from './fixtures/crawl';
afterEach(async () => {cleanup(); await i18n.changeLanguage('en');});

const cases = ['en', 'pl'].flatMap(language => ['start','seed','sitemap','link','resume'].map(kind => ({language,kind})));
it.each(cases)('renders real $language labels for $kind in table and evidence', async ({language,kind}) => {
  await i18n.changeLanguage(language);
  const t = i18n.getFixedT(language);
  const page = createCrawlPageFixture({discovery_sources:[{kind,source_url:null,anchor_text:null}]});
  render(<><table><tbody><tr><CrawlPageDiscoveryCell page={page} t={t}/></tr></tbody></table>
    <CrawlPageEvidenceDetails page={page} evidenceUrl={page.url} t={t}/></>);
  const label = t(`mapUi.discovery.${kind}`);
  expect(label).not.toContain('mapUi.discovery.');
  expect(screen.getAllByText(label)).toHaveLength(2);
  expect(document.body.textContent).not.toContain('crawl.discovery.');
  if(kind==='resume') expect(label).toBe(language==='pl' ? 'Zapisana kolejka crawla' : 'Saved crawl frontier');
});
