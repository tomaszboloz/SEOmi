import type { TFunction } from 'i18next';
import { allModelAnalysisStates } from '@/services/multimodal';

export const CrawlModelAnalysisNotice = ({ t }: { t: TFunction }) => (
  <aside role="note" className="mb-3 rounded border border-slate-700 bg-slate-900/50 p-3 text-xs text-slate-400">
    <p>{t('altCheckUi.visualNotice')}</p>
    <ul className="my-1 flex flex-wrap gap-x-4 gap-y-1">
      {allModelAnalysisStates().map((state) => (
        <li key={state.analysis}>
          {t(`altCheckUi.analyses.${state.analysis}`)}: {t(`altCheckUi.statuses.${state.status}`)}
        </li>
      ))}
    </ul>
    <p>{t('altCheckUi.noScorePenalty')}</p>
  </aside>
);
