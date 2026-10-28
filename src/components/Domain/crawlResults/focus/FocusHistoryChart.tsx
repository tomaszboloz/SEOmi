import { useTranslation } from 'react-i18next';
import type { HistorySeries } from '@/services/siteFocusMonitoring';

const W = 480;
const H = 160;
const PAD = 24;
const signed = (value: number): string => (value > 0 ? `+${value}` : `${value}`);

export interface FocusHistoryChartProps { series: HistorySeries }

/** Accessible SVG line chart of the Site Focus Score per full analysis, with change markers. */
export const FocusHistoryChart = ({ series }: FocusHistoryChartProps) => {
  const { t, i18n } = useTranslation();
  const { points, markers } = series;
  const rtl = i18n.dir() === 'rtl';
  const step = (W - PAD * 2) / Math.max(1, points.length - 1);
  const xOf = (index: number): number => (rtl ? W - PAD - index * step : PAD + index * step);
  const yOf = (score: number): number => H - PAD - (Math.min(100, Math.max(0, score)) / 100) * (H - PAD * 2);
  const date = (at: string): string => new Date(at).toLocaleDateString(i18n.language);
  const indexOf = (runId: string): number => points.findIndex((point) => point.runId === runId);
  // Topic-selection modes are stored as codes; show them in the reader's language.
  const modeLabels = (code: string, params: Record<string, unknown>): Record<string, unknown> => (code === 'core-mode-changed'
    ? { ...params, from: t(`focus.history.mode.${String(params.from)}`), to: t(`focus.history.mode.${String(params.to)}`) }
    : params);
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <section aria-labelledby="focus-history-title" className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 id="focus-history-title" className="text-sm font-semibold text-slate-200">{t('focus.history.title')}</h2>
      {points.length < 2 ? (
        <p className="text-xs text-slate-500">{t('focus.history.empty')}</p>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={t('focus.history.aria', { count: points.length, from: first.score, to: last.score })}
            className="h-40 w-full"
          >
            {[0, 50, 100].map((tick) => (
              <g key={tick}>
                <line x1={PAD} x2={W - PAD} y1={yOf(tick)} y2={yOf(tick)} className="stroke-slate-800" />
                <text x={rtl ? W - 2 : 2} y={yOf(tick) + 3} textAnchor={rtl ? 'end' : 'start'} className="fill-slate-500 text-[9px]">{tick}</text>
              </g>
            ))}
            <polyline fill="none" strokeWidth={2} className="stroke-emerald-400" points={points.map((point, index) => `${xOf(index)},${yOf(point.score)}`).join(' ')} />
            {points.map((point, index) => (
              <circle key={point.runId} cx={xOf(index)} cy={yOf(point.score)} r={3} className="fill-emerald-300">
                <title>{t('focus.history.point', { date: date(point.at), score: point.score })}</title>
              </circle>
            ))}
            {markers.map((marker, index) => (
              <circle key={`${marker.runId}:${marker.code}:${index}`} cx={xOf(indexOf(marker.runId))} cy={yOf(marker.score)} r={6} fill="none" strokeWidth={2} className={marker.delta < 0 ? 'stroke-red-400' : 'stroke-amber-300'} />
            ))}
          </svg>
          <ul aria-label={t('focus.history.annotations')} className="space-y-1 text-xs text-slate-300">
            {markers.map((marker, index) => (
              <li key={`${marker.runId}:${marker.code}:${index}`}>
                <span className="text-slate-500">{date(marker.at)}: </span>
                {t(`focus.history.${marker.code}`, { ...modeLabels(marker.code, marker.params), delta: signed(marker.delta), defaultValue: marker.code })}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
};
