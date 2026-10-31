// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';

const drop = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('@/services/monitoringAlerts', () => ({ monitorScoreDrop: drop }));

import { monitorIgosDrop } from '@/services/igos/alert';
import type { IgosHistoryEntry } from '@/services/igos/history';

const row = (runAt: string, igos: number | null, over: Partial<IgosHistoryEntry> = {}): IgosHistoryEntry => ({
  runAt, targetUrl: 'https://a.test', provider: 'p', model: 'm', igos, status: 'ready', availableDocs: 3, requestedDocs: 3, docUrls: ['u1'], ...over,
});

beforeEach(() => drop.mockClear());

it('alerts on a drop with the same provider, model and TOP set', async () => {
  await monitorIgosDrop('p1', 'seo', [row('2', 40), row('1', 60)]);
  expect(drop).toHaveBeenCalledWith('p1', 'igos', { score: 60 }, { score: 40 }, 'seo-2', undefined, 'seo');
});

it('stays silent without project, history, or comparable basis', async () => {
  await monitorIgosDrop(null, 'seo', [row('2', 40), row('1', 60)]);
  await monitorIgosDrop('p1', 'seo', [row('1', 60)]);
  await monitorIgosDrop('p1', 'seo', [row('2', 40, { model: 'x' }), row('1', 60)]);
  await monitorIgosDrop('p1', 'seo', [row('2', 40, { docUrls: ['u2'] }), row('1', 60)]);
  expect(drop).not.toHaveBeenCalled();
});
