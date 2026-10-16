import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { Quadrant } from '@/services/topicalAuthority';

const SIZE = 220;
const PAD = 22;

/** Quadrant rectangles in data space: [id, sfsFrom, sfsTo, tasFrom, tasTo]. */
const CELLS: Array<[Quadrant, number, number, number, number]> = [
  ['diluted_giant', 0, 75, 60, 100],
  ['unfocused_generalist', 0, 75, 0, 60],
  ['dominant_authority', 75, 100, 75, 100],
  ['boutique_specialist', 75, 100, 0, 75],
];

export interface AuthorityMatrixProps { sfs: number; tas: number | null; quadrant: Quadrant | null }

const scale = (value: number): number => PAD + (Math.min(100, Math.max(0, value)) / 100) * (SIZE - PAD * 2);

/** SFS (x) against TAS (y): purity against completeness, four strategic quadrants. */
export const AuthorityMatrix = ({ sfs, tas, quadrant }: AuthorityMatrixProps) => {
  const { t, i18n } = useTranslation();
  const rtl = i18n.dir() === 'rtl';
  const x = (value: number): number => (rtl ? SIZE - scale(value) : scale(value));
  const y = (value: number): number => SIZE - scale(value);
  return (
    <section aria-labelledby="authority-matrix-title" className="space-y-2">
      <h3 id="authority-matrix-title" className="flex items-center gap-1 text-sm font-semibold text-slate-200">{t('authority.matrix.title')} <HelpTip id="authority.matrix" /></h3>
      {tas === null ? <p className="text-xs text-slate-500">{t('authority.matrix.pending')}</p> : (
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={t('authority.matrix.aria', { sfs, tas, quadrant: t(`authority.quadrant.${quadrant}`) })} className="h-56 w-56 max-w-full">
          {CELLS.map(([id, x0, x1, y0, y1]) => (
            <rect key={id} data-quadrant={id} x={Math.min(x(x0), x(x1))} y={y(y1)} width={Math.abs(x(x1) - x(x0))} height={y(y0) - y(y1)}
              className={id === quadrant ? 'fill-emerald-500/20 stroke-emerald-400' : 'fill-slate-900 stroke-slate-700'} />
          ))}
          <circle cx={x(sfs)} cy={y(tas)} r={6} className="fill-emerald-300 stroke-slate-950" strokeWidth={2} />
          <text x={x(sfs)} y={y(tas) - 10} textAnchor="middle" className="fill-slate-100 text-[10px]">{t('authority.matrix.you')}</text>
          <text x={SIZE / 2} y={SIZE - 4} textAnchor="middle" className="fill-slate-500 text-[9px]">{t('authority.matrix.axisX')}</text>
          <text x={6} y={SIZE / 2} className="fill-slate-500 text-[9px]">{t('authority.matrix.axisY')}</text>
        </svg>
      )}
      {quadrant && <p className="text-xs text-slate-300"><strong className="text-slate-100">{t(`authority.quadrant.${quadrant}`)}</strong>: {t(`authority.quadrantHint.${quadrant}`)}</p>}
    </section>
  );
};
