import type { PageAuditData, SiteCrawlResult } from '@/types';
import { sendProjectNotification } from './delivery';
import { reserveCompletionNotification, type CompletionNotificationType } from './dedupe';
import i18n from '@/i18n';
import { comparableCrawlScore } from '@/services/crawlHealthScore';

export interface CompletionNotificationOptions { runId?: string }

const sendCompletion = async (
  projectId: string,
  runId: string | undefined,
  type: CompletionNotificationType,
  build: () => { title: string; body: string },
): Promise<void> => {
  const reservation = runId ? reserveCompletionNotification(projectId, runId, type) : null;
  if (reservation?.duplicate) return;
  const sent = await sendProjectNotification(projectId, build);
  reservation?.finish(sent);
};

export const notifyAuditCompleted = async (
  projectId: string,
  audit: PageAuditData,
  previousScore?: number,
  options?: CompletionNotificationOptions,
): Promise<void> => {
  await sendCompletion(projectId, options?.runId || audit.timestamp, 'audit', () => {
    const regression = typeof previousScore === 'number' && audit.health_score < previousScore;
    const host = new URL(audit.final_url).hostname;
    const delta = regression ? previousScore - audit.health_score : 0;
    return {
      title: regression ? i18n.t('runtimeErrors.desktop.auditRegression') : i18n.t('runtimeErrors.desktop.auditComplete'),
      body: regression
        ? i18n.t('runtimeErrors.desktop.auditRegressionBody', { host, delta, previous: previousScore, current: audit.health_score })
        : i18n.t('runtimeErrors.desktop.auditCompleteBody', { host, score: audit.health_score }),
    };
  });
};

export const notifyCrawlCompleted = async (
  projectId: string,
  crawl: SiteCrawlResult,
  previousResult?: SiteCrawlResult,
  options?: CompletionNotificationOptions,
): Promise<void> => {
  const observedRunId = (crawl as SiteCrawlResult & { runId?: string }).runId;
  await sendCompletion(projectId, options?.runId || observedRunId, 'crawl', () => {
    const previousHealthScore = comparableCrawlScore(crawl, previousResult);
    const regression = typeof previousHealthScore === 'number' && crawl.health_score < previousHealthScore;
    const host = new URL(crawl.start_url).hostname;
    const delta = regression ? previousHealthScore - crawl.health_score : 0;
    return {
      title: regression ? i18n.t('runtimeErrors.desktop.crawlRegression') : i18n.t('runtimeErrors.desktop.crawlCompleted'),
      body: regression
        ? i18n.t('runtimeErrors.desktop.crawlRegressionBody', { host, delta, previous: previousHealthScore, current: crawl.health_score, pages: crawl.pages_crawled })
        : i18n.t('runtimeErrors.desktop.crawlCompletedBody', { host, pages: crawl.pages_crawled, score: crawl.health_score }),
    };
  });
};
