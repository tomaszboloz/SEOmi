import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { ExecutiveAction } from '@/services/actionFeed';
import type { HssReport } from '@/services/hss';
import type { CodeParams } from '@/services/siteFocus/types';
import type { CrawlTab } from '../helpers/crawlResultsTabsConfig';
import { codeTitle } from '../focus/focusText';
import { ExecutionCardDetails } from './ExecutionCardDetails';

const MAX_SHOWN = 25;

/** Reuses each module's own action wording; unknown codes fall back to the code itself. */
export const actionTitle = (t: TFunction, action: ExecutiveAction): string => {
  const [, code = action.type] = action.type.split(':');
  const params = (action.evidence[0]?.params ?? {}) as CodeParams;
  if (action.source === 'sfs' && action.type !== 'internal-link') return codeTitle(t, 'recommendation', code, params);
  if (action.source === 'tas') return t(`authority.rec.${code}`, { ...params, defaultValue: code });
  if (action.source === 'eetv') return t(`trust.findings.code.${code}`, { ...params, defaultValue: code });
  return t('executive.actions.internalLink', { from: action.urls[0] ?? '', to: action.urls[1] ?? '' });
};

const signed = (value: number): string => `${value > 0 ? '+' : ''}${value}`;

interface FeedProps { actions: ExecutiveAction[]; onOpen: (tab: CrawlTab) => void; hss?: HssReport | null; projectId?: string | null }

/** Action feed (#89 / #73 GEM-73-05): explicit delta, effort range, conflicts and a drill-down to the module screen. */
export const ExecutiveActionFeed = ({ actions, onOpen, hss, projectId }: FeedProps) => {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="executive-actions-title" className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 id="executive-actions-title" className="text-sm font-semibold text-slate-200">{t('executive.actions.title')}</h2>
      <p className="text-xs text-slate-400">{t('executive.actions.hint')}</p>
      {!actions.length ? <p className="text-xs text-slate-400">{t('executive.actions.empty')}</p> : (
        <ol className="space-y-2">
          {actions.slice(0, MAX_SHOWN).map((action) => (
            <li key={action.id} className={`rounded-lg border p-3 text-xs ${action.blocked ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-800 bg-slate-950/40'}`}>
              <p className="font-medium text-slate-100">{actionTitle(t, action)}</p>
              <p className="mt-1 flex flex-wrap gap-x-3 text-slate-300">
                <span>{action.hssDelta === null ? t('executive.actions.deltaUnavailable') : t('executive.actions.delta', { value: signed(action.hssDelta) })}</span>
                {action.moduleDelta && <span>{t('executive.actions.moduleDelta', { module: t(`executive.module.${action.moduleDelta.module}`), value: signed(action.moduleDelta.value) })}</span>}
                <span>{action.effort ? t('executive.actions.effort', { min: action.effort.minHours, max: action.effort.maxHours }) : t('executive.actions.effortUnknown')}</span>
                <span>{t('executive.actions.scope', { urls: action.urls.length, evidence: action.evidence.length })}</span>
              </p>
              {action.blocked && <p className="mt-1 font-semibold text-amber-200">{t('executive.actions.blocked')}</p>}
              {action.conflicts.map((conflict) => <p key={`${conflict.kind}|${conflict.withAction ?? ''}`} className="mt-1 text-amber-100">{t(`executive.actions.conflict.${conflict.kind}`, { count: conflict.urls.length })}</p>)}
              {action.dependsOn.length > 0 && <p className="mt-1 text-slate-400">{t('executive.actions.dependsOn', { count: action.dependsOn.length })}</p>}
              <button type="button" onClick={() => onOpen(action.drillTab)} className="mt-2 rounded border border-slate-700 px-2 py-1 text-slate-200 hover:border-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
                {t('executive.actions.open', { tab: t(`crawl.tabs.${action.drillTab}`) })}
              </button>
              <ExecutionCardDetails action={action} hss={hss} projectId={projectId} onOpen={onOpen} />
            </li>
          ))}
        </ol>
      )}
      {actions.length > MAX_SHOWN && <p className="text-xs text-slate-400">{t('executive.actions.more', { count: actions.length - MAX_SHOWN })}</p>}
    </section>
  );
};
