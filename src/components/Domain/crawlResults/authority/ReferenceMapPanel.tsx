import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReferenceState } from '@/hooks/useTopicalAuthority';
import type { ReferenceTaxonomy } from '@/services/topicalAuthority';
import { ENTITY_MODES } from '@/services/topicalAuthority';
import type { EntitySettings } from '@/services/topicalAuthorityMonitoring';
import { TaxonomyMergePreview } from './TaxonomyMergePreview';

export interface ReferenceMapPanelProps {
  taxonomy: ReferenceTaxonomy | null;
  state: ReferenceState;
  /** `withQuestions`: user opted in to the real People Also Ask block (separately billed DataForSEO advanced SERP). */
  onBuild: (withQuestions: boolean) => void;
  onCancel: () => void;
  onClear: () => void;
  projectId?: string | null;
  /** Opt-in scheduled refresh of this map after native crawls (policy-gated: cooldown, retry backoff, budget). */
  /** Optional Knowledge Graph link: asks Wikidata (public API through the native feed) for each pillar. */
  onLinkPillars?: () => void;
  entities?: EntitySettings;
  onEntities?: (settings: EntitySettings) => void;
  autoRefresh?: boolean;
  onAutoRefresh?: (enabled: boolean) => void;
}

/** Builds the market map from real SERP data; shows an honest empty state when no source is connected. */
/** Example Ollama model name, a technical identifier rather than translatable copy. */
const OLLAMA_MODEL_EXAMPLE = 'llama3.2';

export const ReferenceMapPanel = ({ taxonomy, state, onBuild, onCancel, onClear, projectId, autoRefresh = false, onAutoRefresh, entities, onEntities, onLinkPillars }: ReferenceMapPanelProps) => {
  const { t, i18n } = useTranslation();
  const { running, progress, failure, error } = state;
  const [withQuestions, setWithQuestions] = useState(false);
  return (
    <section aria-labelledby="authority-ref-title" className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="authority-ref-title" className="text-sm font-semibold text-slate-100">{t('authority.reference.title')}</h2>
        <div className="flex gap-2">
          {running ? (
            <button type="button" onClick={onCancel} className="rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-200">{t('authority.reference.cancel')}</button>
          ) : (
            <button type="button" onClick={() => onBuild(withQuestions)} className="rounded-lg border border-emerald-500/40 px-3 py-1 text-xs text-emerald-200">{taxonomy ? t('authority.reference.rebuild') : t('authority.reference.build')}</button>
          )}
          {taxonomy && !running && <button type="button" onClick={onClear} className="rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-300">{t('authority.reference.clear')}</button>}
        </div>
      </header>
      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input type="checkbox" checked={withQuestions} disabled={running} onChange={(event) => setWithQuestions(event.target.checked)} />
        {t('authority.reference.withPaa')}
      </label>
      {entities && onEntities && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
          <label className="flex items-center gap-2">
            {t('authority.reference.entities.label')}
            <select value={entities.mode} disabled={running} onChange={(event) => onEntities({ ...entities, mode: event.target.value as EntitySettings['mode'] })} className="rounded border border-slate-700 bg-slate-950 px-2 py-1">
              {ENTITY_MODES.map((mode) => <option key={mode} value={mode}>{t(`authority.reference.entities.${mode}`)}</option>)}
            </select>
          </label>
          {entities.mode === 'ollama' && (
            <label className="flex min-w-0 items-center gap-2">
              {t('authority.reference.entities.model')}
              <input value={entities.model} disabled={running} onChange={(event) => onEntities({ ...entities, model: event.target.value })} placeholder={OLLAMA_MODEL_EXAMPLE} className="w-40 min-w-0 rounded border border-slate-700 bg-slate-950 px-2 py-1" />
            </label>
          )}
        </div>
      )}
      {onAutoRefresh && (
        <label className="flex items-start gap-2 text-xs text-slate-300">
          <input type="checkbox" checked={autoRefresh} onChange={(event) => onAutoRefresh(event.target.checked)} className="mt-0.5" />
          <span className="min-w-0 break-words">{t('authority.reference.autoRefresh')}</span>
        </label>
      )}
      {taxonomy ? (
        <p className="text-xs text-slate-300">{t('authority.reference.info', { subtopics: taxonomy.subtopics.length, pillars: taxonomy.pillars.length, competitors: taxonomy.competitors.length, source: taxonomy.source || '—', date: new Date(taxonomy.builtAt).toLocaleDateString(i18n.language) })}{' '}
          {taxonomy.paaCount ? t('authority.reference.paaUsed', { count: taxonomy.paaCount }) : t('authority.reference.paaMissing')}</p>
      ) : !running && !failure && !error && <p className="text-xs text-slate-400">{t('authority.reference.intro')}</p>}
      {taxonomy && !running && onLinkPillars && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
          <button type="button" onClick={onLinkPillars} className="rounded-lg border border-slate-600 px-3 py-1 text-slate-200">{t('authority.reference.kg.button')}</button>
          {taxonomy.pillars.some((pillar) => pillar.entityId) && (
            <span className="min-w-0 break-words">{t('authority.reference.kg.summary', { linked: taxonomy.pillars.filter((pillar) => pillar.entityId).length, review: taxonomy.pillars.filter((pillar) => pillar.entityMatch === 'search').length })}</span>
          )}
        </div>
      )}
      {taxonomy && !running && <TaxonomyMergePreview taxonomy={taxonomy} projectId={projectId} />}
      {running && <p role="status" className="text-xs text-slate-300">{t(`authority.reference.progress.${progress?.phase ?? 'serp'}`, { done: progress?.done ?? 0, total: progress?.total ?? 0, domain: progress?.phase === 'crawl' ? progress.domain : '' })}</p>}
      {error && <p role="alert" className="text-xs text-red-300">{t('authority.reference.error', { error })}</p>}
      {failure?.status === 'cancelled' && <p className="text-xs text-slate-400">{t('authority.reference.cancelled')}</p>}
      {failure?.status === 'unavailable' && (
        <div role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-100">
          <strong>{t('authority.reference.unavailableTitle')}</strong>
          <p>{t(`authority.reference.unavailable.${failure.reason}`, { error: failure.error ?? '' })}</p>
        </div>
      )}
    </section>
  );
};
