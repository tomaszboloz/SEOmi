import { sendProjectNotification } from './delivery';
import { reserveCompletionNotification } from './dedupe';
import i18n from '@/i18n';

export interface BatchAuditNotificationSummary {
  completed: number;
  failed: number;
  queued: number;
  regressionCount: number;
  stopped: boolean;
  runId?: string;
}

/**
 * Batch runs intentionally produce one bounded local notification instead of
 * one notification per URL. The summary contains no page URL or audit body.
 */
export const notifyBatchCompleted = async (
  projectId: string,
  summary: BatchAuditNotificationSummary,
): Promise<void> => {
  const reservation = summary.runId ? reserveCompletionNotification(projectId, summary.runId, 'batch') : null;
  if (reservation?.duplicate) return;
  const sent = await sendProjectNotification(projectId, () => {
    const title = summary.stopped
      ? i18n.t('runtimeErrors.desktop.queueStopped')
      : i18n.t('runtimeErrors.desktop.queueCompleted');
    const regression = summary.regressionCount > 0
      ? i18n.t('runtimeErrors.desktop.regressions', { count: summary.regressionCount })
      : '';
    const pending = summary.queued > 0 ? i18n.t('runtimeErrors.desktop.pending', { count: summary.queued }) : '';
    return {
      title,
      body: i18n.t('runtimeErrors.desktop.queueBody', { completed: summary.completed, failed: summary.failed, pending, regression }),
    };
  });
  reservation?.finish(sent);
};
