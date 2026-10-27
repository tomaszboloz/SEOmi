import type { AddSemanticChange, PageIndex } from './types';
import { comparisonText, pageTerms } from './evidence';

export const comparePageChanges = (beforeIndex: PageIndex, afterIndex: PageIndex, add: AddSemanticChange): void => {
  for (const [url, page] of afterIndex.byIdentity) {
    if (beforeIndex.byIdentity.has(url)) continue;
    add({ id: `url-added:${url}`, code: 'url-added', direction: 'added', title: comparisonText('urlAddedTitle'),
      detail: comparisonText('urlAddedDetail'),
      urls: [page.url], evidence: [comparisonText('http', { status: page.http_status }), comparisonText('terms', { count: pageTerms(page).size })] });
  }
  for (const [url, page] of beforeIndex.byIdentity) {
    if (afterIndex.byIdentity.has(url)) continue;
    add({ id: `url-not-observed:${url}`, code: 'url-not-observed', direction: 'not-observed', title: comparisonText('urlMissingTitle'),
      detail: comparisonText('urlMissingDetail'),
      urls: [page.url], evidence: [comparisonText('previousHttp', { status: page.http_status }), comparisonText('previousTerms', { count: pageTerms(page).size })] });
  }

  for (const [url, afterPage] of afterIndex.byIdentity) {
    const beforePage = beforeIndex.byIdentity.get(url);
    if (!beforePage) continue;
    const beforeTerms = pageTerms(beforePage);
    const afterTerms = pageTerms(afterPage);
    const addedTerms = [...afterTerms].filter(([term]) => !beforeTerms.has(term)).map(([, term]) => term);
    const missingTerms = [...beforeTerms].filter(([term]) => !afterTerms.has(term)).map(([, term]) => term);
    if (addedTerms.length || missingTerms.length) add({
      id: `content-terms:${url}`, code: 'content-terms-changed', direction: 'changed', title: comparisonText('contentTermsTitle'),
      detail: comparisonText('contentTermsDetail'),
      urls: [afterPage.url], evidence: [comparisonText('addedTerms', { value: addedTerms.slice(0, 12).join(', ') || comparisonText('missing') }), comparisonText('missingTerms', { value: missingTerms.slice(0, 12).join(', ') || comparisonText('missing') })] });
  }

};
