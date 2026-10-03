import { beforeEach, expect, it } from 'vitest';
import { boundedExternalLinkLimit, isCurrentExternalLinkCheck } from '@/stores/tools/externalLinks/session';
import { useProjectStore } from '@/stores/projectStore';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
beforeEach(() => { localStorage.clear(); useProjectStore.setState({ activeProjectId: 'external-session' }); });

it.each([[0, 1], [-10, 1], [4.8, 4], [1_001, 1_000], [100, 100],
  [NaN, 1], [Infinity, 1], [-Infinity, 1]])('bounds requested %s checks to %s', (requested, expected) => {
  expect(boundedExternalLinkLimit(requested)).toBe(expected);
});

it('requires both the originating project and exact progress request identity', () => {
  const { store } = isolatedToolsSlice(() => ({}));
  expect(isCurrentExternalLinkCheck('external-session', 'request', store.getState)).toBe(false);
  store.setState({ crawlExternalLinkCheckProgress: { requestId: 'request', completed: 0, total: 1, currentUrl: '' } });
  expect(isCurrentExternalLinkCheck('external-session', 'request', store.getState)).toBe(true);
  expect(isCurrentExternalLinkCheck('external-session', 'older', store.getState)).toBe(false);
  useProjectStore.setState({ activeProjectId: 'other-project' });
  expect(isCurrentExternalLinkCheck('external-session', 'request', store.getState)).toBe(false);
});
