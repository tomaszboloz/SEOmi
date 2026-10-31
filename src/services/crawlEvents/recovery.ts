import type { InterruptedCrawl } from '@/stores/tools/contracts';
import { buildCrawlCheckpoint } from '@/stores/tools/checkpoints/results';
import { closeInterruptedCrawlLog, listOpenCrawlLogs, loadCrawlLog } from './nativeLog';
import { recoveredResumeBase, replayCrawlLog, type CrawlResumeBase } from './replay';

const unique = (values: string[]) => [...new Set(values)].slice(0, 20_000);

/**
 * Adds the pages logged by the native crawler to the restart checkpoint of the
 * same run id. A run still crawling in this window, an older checkpoint without
 * a run id, or a run whose log is already closed is left unchanged.
 */
export const attachCrawlLog = async (
  projectId: string,
  checkpoint: InterruptedCrawl | null,
  isLive: (runId: string) => boolean,
): Promise<InterruptedCrawl | null> => {
  const runId = checkpoint?.runId;
  if (!checkpoint || !runId || checkpoint.baseRunId || isLive(runId)) return checkpoint;
  const open = await listOpenCrawlLogs(projectId);
  if (!open.some((log) => log.run_id === runId)) return checkpoint;
  const recovered = replayCrawlLog(runId, await loadCrawlLog(projectId, runId));
  const logged = buildCrawlCheckpoint({ pages: recovered.pages });
  const completed = unique([...(checkpoint.completedUrls ?? []), ...(logged.completedUrls ?? [])]);
  const done = new Set(completed);
  return {
    ...checkpoint,
    completedUrls: completed,
    frontierUrls: unique([...(checkpoint.frontierUrls ?? []), ...(logged.frontierUrls ?? [])]).filter((url) => !done.has(url)),
    recoveredRunId: runId,
    recoveredPages: recovered.pages.length,
    recoveredInvalidPages: recovered.invalidPages,
  };
};

/** Loads the logged pages for a resume, then closes that log so it is offered only once. */
export const takeRecoveredBase = async (projectId: string, runId: string): Promise<CrawlResumeBase> => {
  const base = recoveredResumeBase(replayCrawlLog(runId, await loadCrawlLog(projectId, runId)));
  await closeInterruptedCrawlLog(projectId, runId);
  return base;
};
