import { useTranslation } from 'react-i18next';
import type { IgosSnapshot } from '@/services/informationGain';

const W = 480;
const H = 120;
const PAD = 24;

/** Accessible SVG line chart of the Information Gain score per analysis. */
export const IgosHistory = ({ history }: { history: IgosSnapshot[] }) => {
  const { t, i18n } = useTranslation();
  const rtl = i18n.dir() === 'rtl';
  const step = (W - PAD * 2) / Math.max(1, history.length - 1);
  const x = (index: number): number => (rtl ? W - PAD - index * step : PAD + index * step);
  const y = (score: number): number => H - PAD - (Math.min(100, Math.max(0, score)) / 100) * (H - PAD * 2);
  return (
    <section aria-labelledby="igos-history-title" className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 id="igos-history-title" className="text-sm font-semibold text-slate-200">{t('infoGain.history.title')}</h2>
      {history.length < 2 ? <p className="text-xs text-slate-500">{t('infoGain.history.empty')}</p> : (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('infoGain.history.aria', { count: history.length, from: history[0].score, to: history[history.length - 1].score })} className="h-32 w-full">
          <polyline fill="none" strokeWidth={2} className="stroke-emerald-400" points={history.map((item, index) => `${x(index)},${y(item.score)}`).join(' ')} />
          {history.map((item, index) => (
            <circle key={item.runId} cx={x(index)} cy={y(item.score)} r={3} className="fill-emerald-300">
              <title>{t('infoGain.history.point', { date: new Date(item.at).toLocaleDateString(i18n.language), score: item.score })}</title>
            </circle>
          ))}
        </svg>
      )}
    </section>
  );
};
