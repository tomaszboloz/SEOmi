import { useTranslation } from 'react-i18next';
import type { AioPageReport } from '@/services/aioReadiness';
import { TONE_TEXT } from '../focus/focusHelpers';

const tone = (score: number): keyof typeof TONE_TEXT => (score >= 75 ? 'green' : score >= 60 ? 'yellow' : 'red');

export const AioPagesTable = ({ pages }: { pages: AioPageReport[] }) => {
  const { t } = useTranslation();
  const rows = [...pages].sort((a, b) => Number(Boolean(a.skipped)) - Number(Boolean(b.skipped)) || a.score - b.score || (a.url < b.url ? -1 : 1));
  if (!rows.length) return <p className="text-sm text-slate-400">{t('aio.pages.empty')}</p>;
  return (
    <section aria-labelledby="aio-pages-title" className="space-y-2">
      <h3 id="aio-pages-title" className="text-sm font-semibold text-slate-200">{t('aio.pages.title')}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-start text-xs text-slate-300">
          <thead>
            <tr className="text-slate-400">
              <th scope="col" className="p-1 text-start">{t('aio.pages.url')}</th>
              <th scope="col" className="p-1 text-start">{t('aio.pages.score')}</th>
              <th scope="col" className="p-1 text-start">{t('aio.pages.chunks')}</th>
              <th scope="col" className="p-1 text-start">{t('aio.pages.facts')}</th>
              <th scope="col" className="p-1 text-start">{t('aio.pages.language')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((page) => (
              <tr key={page.url} className="border-t border-slate-800">
                <td className="max-w-md break-all p-1">{page.url}</td>
                {page.skipped ? (
                  <td colSpan={4} className="p-1 text-slate-400">{t(`aio.skip.${page.skipped}`)}</td>
                ) : (
                  <>
                    <td className={`p-1 font-semibold tabular-nums ${TONE_TEXT[tone(page.score)]}`}>{page.score}</td>
                    <td className="p-1 tabular-nums">{page.chunkCount}</td>
                    <td className="p-1 tabular-nums">{page.tripleCount}</td>
                    <td className="p-1">{page.language}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
