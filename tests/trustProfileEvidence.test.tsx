import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TrustProfileEvidence } from '@/components/Domain/crawlResults/trust/TrustProfileEvidence';
import i18n from '@/i18n';
import type { EntityReconciliation, ProfileEvidence } from '@/services/eeatTrust';
import { classifyProfiles, declarationRecall, reconciliationStatus } from '@/services/eeatTrust/identifiers';
import { isKnownProfileDetail, profileIdentifierUrl } from '@/services/eeatTrust/profileLinks';

// 0000-0002-1825-0097 is the ORCID documentation example id; Q42 is a long-standing Wikidata item.
const ORCID = 'https://orcid.org/0000-0002-1825-0097';
const reconcile = (profiles: ProfileEvidence[]): EntityReconciliation => ({
  role: 'author', profiles, declarationRecall: declarationRecall(profiles), status: reconciliationStatus(profiles), evidence: 'declared',
});

describe('profile identifier links (#87)', () => {
  it('builds canonical ORCID and Wikidata links from parsed ids, not from the declared URL', () => {
    const [orcid, wikidata] = classifyProfiles([ORCID.replace('https://', 'http://www.'), 'https://m.wikidata.org/wiki/Q42']);
    expect(profileIdentifierUrl(orcid)).toBe(ORCID);
    expect(profileIdentifierUrl(wikidata)).toBe('https://www.wikidata.org/wiki/Q42');
  });

  it('gives no link for bad checksums, other kinds or missing ids', () => {
    expect(profileIdentifierUrl({ kind: 'orcid', id: '0000-0002-1825-0098' })).toBeUndefined();
    expect(profileIdentifierUrl({ kind: 'wikidata', id: 'Q0' })).toBeUndefined();
    expect(profileIdentifierUrl({ kind: 'social', id: 'Q42' })).toBeUndefined();
    expect(profileIdentifierUrl({ kind: 'orcid' })).toBeUndefined();
  });

  it('recognises only registry detail codes', () => {
    expect(isKnownProfileDetail('rate-budget')).toBe(true);
    expect(isKnownProfileDetail('something-else')).toBe(false);
    expect(isKnownProfileDetail(undefined)).toBe(false);
  });
});

describe('TrustProfileEvidence', () => {
  it('shows a dash, not 0%, when nothing was reconciled', () => {
    const { container } = render(<TrustProfileEvidence profiles={[]} />);
    expect(container.querySelector('summary')?.textContent).toBe(
      `${i18n.t('trust.entities.identityEvidence')} · ${i18n.t('trust.identity.status.unavailable')} · —`,
    );
    expect(screen.getByText(i18n.t('trust.entities.unavailableNote'))).toBeTruthy();
  });

  it('renders translated kind, tier, status, detail and a canonical id link', () => {
    const [orcid, social] = classifyProfiles([ORCID, 'https://x.com/someone']);
    const fetched: ProfileEvidence = { ...orcid, status: 'unavailable', detail: 'transport-error' };
    render(<TrustProfileEvidence profiles={[fetched, social]} reconciliation={reconcile([fetched, social])} />);
    const link = screen.getByRole('link', { name: '0000-0002-1825-0097' });
    expect(link.getAttribute('href')).toBe(ORCID);
    const [first, second] = screen.getAllByTestId('trust-sameas-profile').map((row) => row.textContent ?? '');
    expect(first).toContain(i18n.t('trust.identity.kind.orcid'));
    expect(first).toContain(i18n.t('trust.identity.tier', { tier: 1 }));
    expect(first).toContain(i18n.t('trust.identity.detail.transport-error'));
    expect(second).toContain(i18n.t('trust.identity.status.syntax-valid'));
    // Unavailable fetch keeps the ORCID declaration (.45) and the social tier (.08).
    expect(document.querySelector('summary')?.textContent).toContain('53%');
  });

  it('keeps unknown detail codes verbatim and reports hidden profiles', () => {
    const profiles = Array.from({ length: 10 }, (_, index): ProfileEvidence => ({ url: `https://example.test/${index}`, kind: 'other', status: 'declared', detail: index === 0 ? 'custom-note' : undefined }));
    render(<TrustProfileEvidence profiles={profiles} reconciliation={reconcile(profiles)} />);
    expect(screen.getAllByTestId('trust-sameas-profile')).toHaveLength(8);
    expect(screen.getAllByTestId('trust-sameas-profile')[0].textContent).toContain('custom-note');
    expect(screen.getByText(i18n.t('trust.identity.more', { n: 2 }))).toBeTruthy();
  });
});
