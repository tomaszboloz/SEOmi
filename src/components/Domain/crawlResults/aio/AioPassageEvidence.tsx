import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { AioChunk, AioIssue } from '@/services/aioReadiness';

type Passage = AioChunk & { url: string };
type SpanKind = NonNullable<NonNullable<AioChunk['selfContainmentDetails']>['spans']>[number]['kind'];

const spanIssue: Record<SpanKind, AioIssue> = {
  dangling: 'dangling-pronoun',
  deictic: 'deictic-context',
  'no-entity': 'no-entity',
};

type ScoreUnit = 'percent' | 'ratio';
type Span = NonNullable<NonNullable<AioChunk['selfContainmentDetails']>['spans']>[number];
type Highlight = { start: number; end: number; kinds: SpanKind[] };

const scoreText = (value: number | undefined, unit: ScoreUnit, na: string): string => {
  if (value === undefined || !Number.isFinite(value)) return na;
  return `${Math.round(unit === 'ratio' ? value * 100 : value)}%`;
};

const countText = (value: number | undefined, na: string): string => value === undefined || !Number.isFinite(value) ? na : String(value);

const isUtf16Boundary = (text: string, index: number): boolean => {
  if (index <= 0 || index >= text.length) return true;
  const before = text.charCodeAt(index - 1);
  const after = text.charCodeAt(index);
  return !(before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff);
};

const validSpan = (span: Span, text: string): boolean => Number.isInteger(span.start) && Number.isInteger(span.end)
  && span.start >= 0 && span.end > span.start && span.end <= text.length
  && isUtf16Boundary(text, span.start) && isUtf16Boundary(text, span.end);

const highlightsFor = (spans: Span[]): Highlight[] => spans
  .slice().sort((left, right) => left.start - right.start || right.end - left.end)
  .reduce<Highlight[]>((ranges, span) => {
    const current = ranges[ranges.length - 1];
    if (current && span.start < current.end) {
      current.end = Math.max(current.end, span.end);
      if (!current.kinds.includes(span.kind)) current.kinds.push(span.kind);
      return ranges;
    }
    ranges.push({ start: span.start, end: span.end, kinds: [span.kind] });
    return ranges;
  }, []);

export const AioPassageEvidence = ({ passage }: { passage: Passage }) => {
  const { t } = useTranslation();
  const evidenceId = useId();
  const na = t('aio.passage.notAvailable');
  const answerFirst = passage.answerFirstAvailability === 'not-applicable'
    ? t('aio.passage.notApplicable')
    : scoreText(passage.answerFirst, 'ratio', na);
  const spans = passage.selfContainmentDetails?.spans ?? [];
  const validSpans = spans.filter((span) => validSpan(span, passage.text));
  const invalidSpans = spans.filter((span) => !validSpan(span, passage.text));
  const highlights = highlightsFor(validSpans);
  const highlightedText = highlights.length ? [
    ...highlights.flatMap((highlight, index) => {
      const previousEnd = index ? highlights[index - 1].end : 0;
      const prefix = passage.text.slice(previousEnd, highlight.start);
      return [prefix, <mark key={`${highlight.start}-${highlight.end}`} title={highlight.kinds.map((kind) => t(`aio.issue.${spanIssue[kind]}`)).join(', ')} data-testid="aio-passage-highlight" data-span-kinds={highlight.kinds.join(',')}>{passage.text.slice(highlight.start, highlight.end)}</mark>];
    }),
    passage.text.slice(highlights[highlights.length - 1].end),
  ] : [];

  return (
    <section className="space-y-2 rounded border border-slate-800/80 bg-slate-900/50 p-2" data-testid="aio-passage-evidence" aria-labelledby={evidenceId}>
      <h4 id={evidenceId} className="font-semibold text-slate-200">{t('aio.passage.evidence')}</h4>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] sm:grid-cols-5">
        <div><dt className="text-slate-500">{t('aio.passage.score')}</dt><dd className="tabular-nums text-slate-200">{scoreText(passage.score, 'percent', na)}</dd></div>
        <div><dt className="text-slate-500">{t('aio.components.self')}</dt><dd className="tabular-nums text-slate-200">{scoreText(passage.selfContainment, 'ratio', na)}</dd></div>
        <div><dt className="text-slate-500">{t('aio.components.spo')}</dt><dd className="tabular-nums text-slate-200">{scoreText(passage.spoDensity, 'ratio', na)}</dd></div>
        <div><dt className="text-slate-500">{t('aio.passage.answerFirst')}</dt><dd className="tabular-nums text-slate-200">{answerFirst}</dd></div>
        <div><dt className="text-slate-500">{t('aio.passage.spoRelations')}</dt><dd className="tabular-nums text-slate-200">{countText(passage.triples, na)}</dd></div>
      </dl>
      <p className="text-[11px] text-slate-400" data-testid="aio-passage-offset">
        {passage.offsets ? t('aio.passage.offset', { start: passage.offsets.start, end: passage.offsets.end }) : t('aio.passage.offsetUnavailable')}
      </p>
      <p className="whitespace-pre-line rounded bg-slate-950 p-2 text-slate-200" data-testid="aio-passage-text"><span className="sr-only">{t('aio.passage.current')}: </span>{highlightedText.length ? highlightedText : passage.text}</p>
      {spans.length > 0 && (
        <div className="space-y-1 text-[11px]">
          <p className="text-slate-500">{t('aio.passage.spans')}</p>
          <ul className="space-y-0.5 text-slate-300" data-testid="aio-passage-spans">
            {spans.map((span, index) => <li key={`${span.kind}-${span.start}-${span.end}-${index}`} className={!validSpan(span, passage.text) ? 'text-amber-200' : undefined}>
              {validSpan(span, passage.text) ? t(`aio.issue.${spanIssue[span.kind]}`) : t('aio.passage.invalidSpan', { start: span.start, end: span.end })} · {span.start}–{span.end}
            </li>)}
          </ul>
          {invalidSpans.length > 0 && <p role="status" data-testid="aio-passage-invalid-spans">{t('aio.passage.invalidSpanCount', { count: invalidSpans.length })}</p>}
        </div>
      )}
    </section>
  );
};
