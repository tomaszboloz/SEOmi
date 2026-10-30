import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatSegmentInput, MAX_SEGMENTS, parseSegmentInput, type FocusSegmentInput, type SegmentFocus } from '@/services/siteFocus';
import { can } from '@/services/team/roles';
import { readIdentity } from '@/services/team/identity';
import { deniedMessage, enforcePermission } from '@/services/team/enforce';

export interface SegmentsPanelProps {
  /** Scored segments of the current report; undefined when none are set. */
  results: SegmentFocus[] | undefined;
  saved: FocusSegmentInput[];
  /** False without a project: segments are a per-project setting and cannot be stored. */
  persisted: boolean;
  onSave: (segments: FocusSegmentInput[]) => FocusSegmentInput[];
}

const lineCount = (text: string): number => text.split('\n').filter((line) => line.trim()).length;

/** User-defined segments of a multi-topic site, each scored against its own Core (#82 GEM-82-05). */
export const SegmentsPanel = ({ results, saved, persisted, onSave }: SegmentsPanelProps) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(() => formatSegmentInput(saved));
  const [dropped, setDropped] = useState<number | null>(null);
  const allowed = can(readIdentity().role, 'modify_site_focus_rules');

  const save = () => {
    if (!enforcePermission('modify_site_focus_rules')) return;
    const kept = onSave(parseSegmentInput(draft));
    setDropped(lineCount(draft) - kept.length);
    setDraft(formatSegmentInput(kept));
  };

  return (
    <section aria-labelledby="focus-segments-title" className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 id="focus-segments-title" className="text-sm font-semibold text-slate-200">{t('focus.segments.title')}</h2>
      <label className="flex flex-col gap-1 text-xs text-slate-300">
        {t('focus.segments.inputLabel')}
        <textarea
          value={draft}
          rows={3}
          placeholder={t('focus.segments.placeholder')}
          readOnly={!allowed || !persisted}
          onChange={(event) => setDraft(event.target.value)}
          className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        />
      </label>
      <button
        type="button"
        onClick={save}
        disabled={!allowed || !persisted}
        className="rounded border border-slate-600 px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      >
        {t('focus.segments.save')}
      </button>
      <p className="text-xs text-slate-400">{t('focus.segments.help', { max: MAX_SEGMENTS })}</p>
      {dropped !== null && dropped > 0 && <p role="alert" className="text-xs text-amber-200">{t('focus.segments.dropped', { count: dropped })}</p>}
      {!persisted && <p role="note" className="text-xs text-amber-200">{t('focus.segments.needsProject')}</p>}
      {results && results.length > 0 && (
        <ul className="space-y-1 text-xs text-slate-300" data-testid="focus-segment-results">
          {results.map((segment) => (
            <li key={segment.pathPrefix}>
              {segment.score === null
                ? t('focus.segments.unavailable', { label: segment.label, prefix: segment.pathPrefix })
                : t('focus.segments.item', {
                  label: segment.label, prefix: segment.pathPrefix, score: segment.score, band: t(`focus.band.${segment.band}`),
                  core: segment.coreLabel, scored: segment.scoredCount, pages: segment.pageCount,
                })}
            </li>
          ))}
        </ul>
      )}
      {!allowed && <p role="note" className="text-xs text-amber-200">{deniedMessage()}</p>}
    </section>
  );
};
