import { useTranslation } from 'react-i18next';
import type { PageIgos } from '@/services/informationGain';
import { BAND_TEXT, FOCUS_RING } from './igosStyle';

export interface IgosPageListProps { pages: PageIgos[]; onSelect: (url: string) => void }

/** Worst first: the pages that repeat the SERP the most. */
export const IgosPageList = ({ pages, onSelect }: IgosPageListProps) => {
  const { t } = useTranslation();
  if (!pages.length) return <p className="text-xs text-slate-500">{t('infoGain.pages.empty')}</p>;
  return (
    <section aria-labelledby="igos-pages-title" className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 id="igos-pages-title" className="text-sm font-semibold text-slate-200">{t('infoGain.pages.title')}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-start text-xs">
          <thead className="text-slate-400">
            <tr>
              <th scope="col" className="py-1 pe-2 text-start">{t('infoGain.pages.url')}</th>
              <th scope="col" className="px-2 text-end">{t('infoGain.pages.score')}</th>
              <th scope="col" className="px-2 text-end">{t('infoGain.pages.echo')}</th>
              <th scope="col" className="px-2 text-end">{t('infoGain.pages.gain')}</th>
              <th scope="col" className="ps-2 text-end">{t('infoGain.pages.drift')}</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((page) => (
              <tr key={page.url} className="border-t border-slate-800">
                <td className="max-w-md truncate py-1 pe-2">
                  <button type="button" onClick={() => onSelect(page.url)} className={`break-all rounded text-start text-emerald-200 hover:underline ${FOCUS_RING}`}>{page.url}</button>
                </td>
                <td className={`px-2 text-end font-semibold tabular-nums ${BAND_TEXT[page.band]}`} title={t(`infoGain.band.${page.band}`)}>{page.score}</td>
                <td className="px-2 text-end tabular-nums text-slate-300">{page.zones.echo}%</td>
                <td className="px-2 text-end tabular-nums text-slate-300">{page.zones.gain}%</td>
                <td className="ps-2 text-end tabular-nums text-slate-300">{page.zones.drift}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
