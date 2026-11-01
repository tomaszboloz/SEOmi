import { createReferenceDeps } from '@/services/topicalAuthorityReference/adapter';
import { runReference } from '@/services/topicalAuthorityReference/run';
import type { CrawlRunRecord } from '@/types';
import { runScheduledAuthority, type ScheduledAuthorityResult } from './scheduledAuthority';

/** Production wiring: the refresh uses the same SERP, DataForSEO budget and crawl dependencies as the Authority tab. */
export const runScheduledAuthorityDefault = (projectId: string, run: CrawlRunRecord): Promise<ScheduledAuthorityResult> =>
  runScheduledAuthority(projectId, run, { refresh: (input) => runReference(createReferenceDeps(), input) });
