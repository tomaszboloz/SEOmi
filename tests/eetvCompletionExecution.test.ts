import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/services/siteFocusMonitoring', () => ({ runScheduledFocus: vi.fn() }));
vi.mock('@/services/desktopNotifications/delivery', () => ({ sendProjectNotification: vi.fn().mockResolvedValue(true) }));

import * as alerts from '@/services/monitoringAlerts';
import { readTrustHistory } from '@/services/eeatTrust';
import { useProjectStore } from '@/stores/projectStore';
import { createCrawlExecutionActions } from '@/stores/tools/crawl/execution';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
import { createCrawlPageFixture, createCrawlResultFixture } from './fixtures/crawl';

const originalProject = useProjectStore.getState();
const page = createCrawlPageFixture({ schema_references: [{ format: 'JSON-LD', declaration_index: 0, property: '@type', value: 'Article' }] });
const result = createCrawlResultFixture({ pages_crawled: 1, pages: [page] });

describe('real crawl completion to EETV history and alert', () => {
  beforeEach(() => {
    localStorage.clear();
    useProjectStore.setState({ activeProjectId: 'eetv-execution' });
    alerts.saveMonitoringSettings('eetv-execution', { ...alerts.defaultMonitoringAlertSettings(), enabled: true, frequency: 'run' });
  });
  afterEach(() => { vi.restoreAllMocks(); useProjectStore.setState(originalProject); });

  it('saves the completed run before recording EETV and dispatching a comparable drop', async () => {
    const saveCrawlRuns = vi.fn().mockResolvedValue({ prunedRuns: 0 });
    const monitor = vi.spyOn(alerts, 'monitorScoreDrop').mockResolvedValue({ alert: null, delivered: false, persisted: false, duplicate: false, emailConfigured: false });
    const fixture = isolatedToolsSlice(createCrawlExecutionActions, { invoke: vi.fn().mockResolvedValue(result), saveCrawlRuns, notifyCrawlCompleted: vi.fn() });
    await fixture.actions.startSiteCrawl('https://example.test/', 1, undefined, 'default', false);
    await fixture.actions.startSiteCrawl('https://example.test/', 1, undefined, 'default', false);
    expect(saveCrawlRuns).toHaveBeenCalledTimes(2);
    expect(readTrustHistory('eetv-execution')).toHaveLength(2);
    expect(monitor).toHaveBeenCalledWith('eetv-execution', 'trust', expect.objectContaining({ profileId: 'eetv-5-layer-v2' }), expect.objectContaining({ profileId: 'eetv-5-layer-v2' }), expect.any(String));
  });
});
