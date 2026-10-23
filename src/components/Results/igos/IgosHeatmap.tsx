import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { HeatmapSection } from '@/services/igos/heatmap';
import type { ChunkZone } from '@/services/igos/types';

const TONE: Record<ChunkZone, string> = {
  echo: 'border-amber-500/60 bg-amber-500/10',
  gain: 'border-emerald-500/60 bg-emerald-500/10',
  drift: 'border-rose-500/60 bg-rose-500/10',
  neutral: 'border-slate-600 bg-slate-800/40',
};

/** Paragraph heatmap: zone is always a text label, never colour alone. Arrow keys move between paragraphs. */
export const IgosHeatmap: React.FC<{ sections: HeatmapSection[] }> = ({ sections }) => {
  const { t } = useTranslation();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const flat = sections.flatMap((section) => section.cells);
  const move = (event: React.KeyboardEvent, index: number) => {
    const next = event.key === 'ArrowDown' ? index + 1 : event.key === 'ArrowUp' ? index - 1 : null;
    if (next === null || next < 0 || next >= flat.length) return;
    event.preventDefault();
    refs.current[next]?.focus();
  };
  if (!flat.length) return <p>{t('igosUi.heatmapEmpty')}</p>;
  const detail = selected === null ? null : flat[selected];
  let index = -1;
  return (
    <div className="space-y-3" data-testid="igos-heatmap">
      <h4 className="flex items-center gap-1 font-medium text-slate-100">{t('igosUi.heatmap')}<HelpTip id="igos.heatmap" /></h4>
      {sections.map((section, sectionIndex) => (
        <section key={sectionIndex} aria-label={section.heading ?? t('igosUi.noHeading')} className="space-y-1">
          <h5 className="text-xs font-semibold text-slate-400">{section.heading ?? t('igosUi.noHeading')}</h5>
          {section.cells.map((cell) => {
            index += 1;
            const at = index;
            return (
              <button key={cell.offset} type="button" ref={(node) => { refs.current[at] = node; }} aria-pressed={selected === at}
                onClick={() => setSelected(at)} onKeyDown={(event) => move(event, at)}
                className={`block w-full rounded border px-2 py-1 text-left text-xs ${TONE[cell.zone]}`}>
                <span className="mr-2 font-semibold uppercase">{t(`igosUi.zone.${cell.label}`)}</span>{cell.excerpt}
              </button>
            );
          })}
        </section>
      ))}
      {detail && (
        <p role="status" className="text-xs text-slate-300">
          {t('igosUi.detail', { offset: detail.offset, topic: detail.topic.toFixed(2), nearest: detail.nearest.toFixed(2) })}{' '}
          {detail.source ? t('igosUi.source', { url: detail.source.url, rank: detail.source.rank }) : t('igosUi.noSource')}
        </p>
      )}
    </div>
  );
};
