// @vitest-environment node
import { expect, it } from 'vitest';
import { HUB_MAX_WORDS_PER_LINK, HUB_MIN_LINKED_DOCUMENTS, looksLikeListing } from '@/services/topicalDiagnosis/thresholds';

it('is a listing only with enough linked documents and little text per link (#106)', () => {
  expect(looksLikeListing(100, HUB_MIN_LINKED_DOCUMENTS - 1)).toBe(false);
  expect(looksLikeListing(HUB_MAX_WORDS_PER_LINK * HUB_MIN_LINKED_DOCUMENTS - 1, HUB_MIN_LINKED_DOCUMENTS)).toBe(true);
  expect(looksLikeListing(HUB_MAX_WORDS_PER_LINK * HUB_MIN_LINKED_DOCUMENTS, HUB_MIN_LINKED_DOCUMENTS)).toBe(false);
  expect(looksLikeListing(500, 0)).toBe(false);
});
