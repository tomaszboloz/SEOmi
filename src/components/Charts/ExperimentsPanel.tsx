import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CrawledPageSummary } from '@/types';
import { addIntervention, listInterventions, removeIntervention } from '@/services/experiments/registry';
import { evaluateIntervention } from '@/services/experiments/evaluate';
import { readGscSnapshots } from '@/services/gscTracker/read';
import { InterventionForm } from './experiments/InterventionForm';
import { ExperimentCard } from './experiments/ExperimentCard';

const ProjectExperiments = ({ projectId, pages }: { projectId: string; pages: CrawledPageSummary[] }) => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState(() => listInterventions(projectId));
  const [removeFailed, setRemoveFailed] = useState(false);
  const snapshots = readGscSnapshots(projectId);
  const urls = [...new Set(pages.map(page => page.url))];
  return <>
    <p>{t('experimentsUi.capacity', { count: 200 })}</p>
    <InterventionForm urls={urls} onAdd={input => {
      const saved = addIntervention(projectId, input);
      if (saved) setEntries(listInterventions(projectId));
      return saved !== null;
    }} />
    {!entries.length && <p>{t('experimentsUi.empty')}</p>}
    {entries.map(intervention => <ExperimentCard key={intervention.id} intervention={intervention}
      evaluation={evaluateIntervention(intervention, snapshots)} onRemove={() => {
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
