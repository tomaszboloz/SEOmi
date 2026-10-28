import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MAX_GSC_POSITION, sanitizePositionRange, type PositionRange } from '@/services/gscTracker/opportunities';
import { readJsonStorage, writeJsonStorage } from '@/services/storage';

const rangeKey = (projectId: string) => `seomi_gsc_near_range_${projectId}_v1`;

/** The project's saved "near top 10" window, or the default 10-20. */
export const readNearRange = (projectId: string | null | undefined): PositionRange =>
  sanitizePositionRange(projectId ? readJsonStorage(rangeKey(projectId), null) : null);

export const writeNearRange = (projectId: string | null | undefined, range: PositionRange): void => {
  if (projectId) writeJsonStorage(rangeKey(projectId), range);
};

const field = 'w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100';

/** Min/max average-position inputs; only a valid window (min < max, 0-100) is applied. */
export function GscNearRangeFields({ range, onChange }: { range: PositionRange; onChange: (range: PositionRange) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState({ min: String(range.min), max: String(range.max) });
  const update = (patch: Partial<typeof draft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    const min = Number(next.min);
    const max = Number(next.max);
    if (next.min.trim() && next.max.trim() && Number.isFinite(min) && Number.isFinite(max) && min >= 0 && max <= MAX_GSC_POSITION && min < max) onChange({ min, max });
  };
  const min = Number(draft.min);
  const max = Number(draft.max);
  const invalid = !draft.min.trim() || !draft.max.trim() || !(min >= 0 && max <= MAX_GSC_POSITION && min < max);
  return <div className="flex flex-wrap items-end gap-3 text-xs text-slate-300">
    <label className="grid gap-1"><span>{t('gscOpportunities.range.min')}</span>
      <input type="number" min={0} max={MAX_GSC_POSITION} step={0.1} value={draft.min} onChange={(event) => update({ min: event.target.value })} className={field} />
    </label>
    <label className="grid gap-1"><span>{t('gscOpportunities.range.max')}</span>
      <input type="number" min={0} max={MAX_GSC_POSITION} step={0.1} value={draft.max} onChange={(event) => update({ max: event.target.value })} className={field} />
    </label>
    <span className={invalid ? 'text-amber-300' : 'text-slate-500'} role={invalid ? 'alert' : undefined}>
      {invalid ? t('gscOpportunities.range.invalid') : t('gscOpportunities.range.hint', { min: range.min, max: range.max })}
    </span>
  </div>;
}
