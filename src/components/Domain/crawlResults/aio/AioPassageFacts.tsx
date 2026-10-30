import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { AioChunk } from '@/services/aioReadiness';

const pct = (value: number): string => `${Math.round(value * 100)}%`;

/**
 * Inspector detail for one chunk (#64 GEM-64-02): the Answer-First components and the SPO facts with
 * their quality Q and negation. Lexical heuristics, not a dependency parser; absent data stays absent.
 */
export const AioPassageFacts = ({ passage }: { passage: AioChunk }) => {
  const { t } = useTranslation();
  const headingId = useId();
  const triples = passage.spoTriples;
  const answer = passage.answerFirstDetails;
  if (!triples && !answer) return null;
  return (
    <section className="space-y-1 rounded border border-slate-800/80 bg-slate-900/50 p-2 text-[11px]" aria-labelledby={headingId} data-testid="aio-passage-facts">
      <h4 id={headingId} className="font-semibold text-slate-200">{t('aio.facts.title')}</h4>
      {answer && (
        <p className="text-slate-400" data-testid="aio-answer-components">
          {t('aio.facts.answerComponents', { similarity: pct(answer.similarity), declarative: answer.declarative ? t('aio.facts.yes') : t('aio.facts.no'), fluff: answer.fluff ? t('aio.facts.yes') : t('aio.facts.no') })}
        </p>
      )}
      {triples && (triples.length ? (
        <ul className="space-y-0.5 text-slate-300" data-testid="aio-spo-list">
          {triples.map((triple, index) => (
            <li key={`${index}-${triple.subject}`} data-negated={triple.negated ? 'true' : 'false'}>
              <span className="text-slate-100">{triple.subject}</span> · <span className="text-sky-300">{triple.predicate}</span> · {triple.object}
              {' '}<span className="rounded bg-slate-800 px-1 text-slate-300">{t('aio.facts.quality', { q: triple.quality ?? '—' })}</span>
              {triple.unit && <span className="ms-1 text-slate-400">{t('aio.facts.unit', { unit: triple.unit })}</span>}
              {triple.negated && <span className="ms-1 rounded bg-amber-500/10 px-1 text-amber-200">{t('aio.facts.negated')}</span>}
            </li>
          ))}
        </ul>
      ) : <p className="text-slate-500">{t('aio.facts.none')}</p>)}
      <p className="text-slate-500">{t('aio.facts.heuristic')}</p>
    </section>
  );
};
