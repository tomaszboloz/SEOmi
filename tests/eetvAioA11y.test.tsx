import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { AioPassageCard } from '@/components/Domain/crawlResults/aio/AioPassageCard';
import { TrustClaimEvidence } from '@/components/Domain/crawlResults/trust/TrustClaimEvidence';
import { TrustJsonLdGenerator } from '@/components/Domain/crawlResults/trust/TrustJsonLdGenerator';
import { mapClaimsToCitations } from '@/services/citationEvidence/claims';
import type { AioChunk } from '@/services/aioReadiness';
import { a11yViolations } from './helpers/a11yRules';

const chunk: AioChunk & { url: string } = {
  url: 'https://site.test/guide', heading: 'Guide', level: 2, text: 'It is a guide. Ibuprofen is 200 mg per tablet.', tokens: 12, windowIndex: 0,
  score: 42, selfContainment: 0.4, answerFirst: 0.8, answerFirstAvailability: 'available', spoDensity: 0.25, triples: 2, issues: ['dangling-pronoun'],
  offsets: { start: 0, end: 46, unit: 'utf16' },
  spoTriples: [{ subject: 'Ibuprofen', predicate: 'is', object: '200 mg per tablet', quality: 1, unit: 'mg', negated: false }],
};

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('EETV and AIO-R structural accessibility (#64 #65 #66, replaces the manual protocol)', () => {
  const locales = ['en', 'pl', 'de', 'ar', 'ja'];
  it.each(locales)('passage inspector card has no structural violations (%s)', async (lng) => {
    await i18n.changeLanguage(lng);
    const { container } = render(<AioPassageCard passage={chunk} index={0} />);
    expect(a11yViolations(container)).toEqual([]);
  });
  it.each(locales)('claim evidence and entailment control have no structural violations (%s)', async (lng) => {
    await i18n.changeLanguage(lng);
    const { container } = render(<TrustClaimEvidence claims={mapClaimsToCitations('Therapy cut risk by 30%, PMID: 42.')} unbacked={0} />);
    expect(a11yViolations(container)).toEqual([]);
  });
  it.each(locales)('JSON-LD generator has no structural violations (%s)', async (lng) => {
    await i18n.changeLanguage(lng);
    const { container } = render(<TrustJsonLdGenerator initial={{ personName: 'Jane Doe', sameAs: [], organizationUrl: 'https://site.test', pageUrl: 'https://site.test/a' }} onClose={() => undefined} />);
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    expect(a11yViolations(container)).toEqual([]);
  });
});
