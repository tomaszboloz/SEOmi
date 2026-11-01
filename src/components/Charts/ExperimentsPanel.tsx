import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CrawledPageSummary } from '@/types';
import { addIntervention, listInterventions, removeIntervention } from '@/services/experiments/registry';
import { evaluateIntervention } from '@/services/experiments/evaluate';
import { readGscSnapshots } from '@/services/gscTracker/read';
import { causalImpactFor } from '@/services/experiments/causalSeries';
import { holmAdjust, twoSidedP } from '@/services/experiments/causalPolicy';
import { causalPageFor } from '@/services/experiments/pageCausal';
import { loadPageSeries } from '@/services/experiments/pageSeries';
import { useToolsStore } from '@/stores/toolsStore';
import { PageSeriesLoader } from './experiments/PageSeriesLoader';
import { InterventionForm } from './experiments/InterventionForm';
import { ExperimentCard } from './experiments/ExperimentCard';

const ProjectExperiments = ({ projectId, pages }: { projectId: string; pages: CrawledPageSummary[] }) => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState(() => listInterventions(projectId));
  const [removeFailed, setRemoveFailed] = useState(false);
  const snapshots = readGscSnapshots(projectId);
  const urls = [...new Set(pages.map(page => page.url))];
  const [, setSeriesVersion] = useState(0);
  const clientId = useToolsStore(state => state.gscClientId).trim();
  const siteUrl = useToolsStore(state => state.gscProperty);
  const saved = loadPageSeries(projectId);
  const causal = entries.map(intervention => intervention.url === 'site' ? causalImpactFor(intervention, snapshots, pages[0]?.url) : causalPageFor(intervention, saved));
  const families = holmAdjust(causal.map(setup => twoSidedP(setup.estimate)));
  return <>
    <p>{t('experimentsUi.capacity', { count: 200 })}</p>
    <InterventionForm urls={urls} onAdd={input => {
      const saved = addIntervention(projectId, input);
      if (saved) setEntries(listInterventions(projectId));
      return saved !== null;
    }} />
    {!entries.length && <p>{t('experimentsUi.empty')}</p>}
    {entries.map((intervention, index) => <ExperimentCard key={intervention.id} intervention={intervention}
      pageLoader={<PageSeriesLoader projectId={projectId} intervention={intervention} clientId={clientId} siteUrl={siteUrl} onLoaded={() => setSeriesVersion(version => version + 1)} />}
      evaluation={evaluateIntervention(intervention, snapshots)} causal={{ ...causal[index], family: families[index] }} onRemove={() => {
        const removed = removeIntervention(projectId, intervention.id);
        setRemoveFailed(!removed);
        if (removed) setEntries(listInterventions(projectId));
      }} />)}
    {removeFailed && <p role="alert">{t('experimentsUi.removeFailed')}</p>}
  </>;
};

export const ExperimentsPanel = ({ projectId, pages }: { projectId: string | null; pages: CrawledPageSummary[] }) => {
  const { t } = useTranslation();
  return <section className="space-y-3 text-xs text-slate-200" aria-label={t('experimentsUi.title')}>
    <h4 className="font-semibold">{t('experimentsUi.title')}</h4>
    <p className="rounded border border-amber-800 p-2">{t('experimentsUi.disclaimer')}</p>
    {projectId ? <ProjectExperiments key={projectId} projectId={projectId} pages={pages} /> : <p>{t('experimentsUi.projectRequired')}</p>}
  </section>;
};
