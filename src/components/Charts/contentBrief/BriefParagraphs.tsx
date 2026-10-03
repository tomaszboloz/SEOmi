import { useTranslation } from 'react-i18next';
import type { BriefModel } from './model';
import { isHttpSourceUrl, matchParagraphToCrawlSource, updateParagraphReview } from '@/services/contentBrief';

export const BriefParagraphs = ({ model }: { model: BriefModel }) => {
  const { t } = useTranslation();
  const { brief, pages, paragraphs, assessment, update } = model;
  return (
      <section aria-label={t('contentBrief.paragraphAria')} className="mt-3 rounded-lg border border-slate-800 p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h5 className="text-[10px] font-semibold text-slate-300">{t('contentBrief.paragraphReviewTitle', { count: paragraphs.length })}</h5><span className="text-[9px] text-slate-600">{t('contentBrief.notSourceValidation')}</span></div>
        <div className="mt-2 space-y-2">{paragraphs.map((paragraph, index) => {
          const review = brief.paragraphReviews.find((item) => item.paragraph === paragraph);
          const treatment = review?.treatment ?? 'unreviewed';
          const sourceEvidence = treatment === 'source-backed' && review?.sourceUrl
            ? matchParagraphToCrawlSource(paragraph, review.sourceUrl, pages)
            : null;
          return <article key={`${index}-${paragraph}`} className="rounded-md border border-slate-800 bg-slate-950/45 p-2.5">
            <p className="line-clamp-3 break-words text-[10px] leading-4 text-slate-400">{t('contentBrief.paragraphPrefix', { index: index + 1, text: paragraph })}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="text-[9px] text-slate-500">{t('contentBrief.classification')}
                <select aria-label={t('contentBrief.paragraphClassificationAria', { index: index + 1 })} className="mt-1 h-8 w-full rounded border border-slate-700 bg-slate-950 px-2 text-[10px] text-slate-200" value={treatment} onChange={(event) => {
                  const nextTreatment = event.target.value as NonNullable<typeof review>['treatment'];
                  const next = updateParagraphReview(brief.paragraphReviews, paragraph, { treatment: nextTreatment, sourceUrl: nextTreatment === 'source-backed' ? review?.sourceUrl ?? '' : '', sourceChecked: false });
                  update({ paragraphReviews: next });
                }}>
                  <option value="unreviewed">{t('contentBrief.unreviewed')}</option><option value="editorial">{t('contentBrief.editorial')}</option><option value="source-backed">{t('contentBrief.sourceBacked')}</option>
                </select>
              </label>
              {treatment === 'source-backed' && <div className="text-[9px] text-slate-500"><label>{t('contentBrief.sourceUrl')}<input aria-label={t('contentBrief.sourceUrl')} value={review?.sourceUrl ?? ''} onChange={(event) => update({ paragraphReviews: updateParagraphReview(brief.paragraphReviews, paragraph, { treatment: 'source-backed', sourceUrl: event.target.value, sourceChecked: false }) })} className="mt-1 h-8 w-full rounded border border-slate-700 bg-slate-950 px-2 text-[10px] text-slate-200" placeholder={t('contentBrief.sourcePlaceholder')} /></label><label className={`mt-1 flex items-center gap-1 ${review?.sourceChecked ? 'text-emerald-300' : 'text-amber-200'}`}><input type="checkbox" aria-label={t('contentBrief.confirmSourceAria', { index: index + 1 })} checked={review?.sourceChecked ?? false} disabled={!isHttpSourceUrl(review?.sourceUrl ?? '')} onChange={(event) => update({ paragraphReviews: updateParagraphReview(brief.paragraphReviews, paragraph, { sourceChecked: event.target.checked }) })} />{t('contentBrief.sourceSupports')}</label></div>}
            </div>
            {treatment === 'source-backed' && sourceEvidence && <p className={`mt-1 rounded border px-2 py-1 text-[9px] leading-4 ${sourceEvidence.matched ? 'border-sky-500/20 bg-sky-500/5 text-sky-200' : 'border-amber-500/20 bg-amber-500/5 text-amber-200'}`}>
              {sourceEvidence.scope === 'not-in-snapshot'
                ? t('contentBrief.notInSnapshot')
                : sourceEvidence.matched
                  ? t('contentBrief.snapshotExcerpt', { kind: sourceEvidence.scope === 'sentence-match' ? t('contentBrief.matchingSentence') : sourceEvidence.scope === 'excerpt' ? t('contentBrief.matchingExcerpt') : t('contentBrief.sharedTerms'), count: sourceEvidence.matchedTerms.length, overlap: sourceEvidence.overlapPercent !== null ? ` · ${sourceEvidence.overlapPercent}%${sourceEvidence.responseSpan ? ` · ${t('contentBrief.evidenceRange', { range: `${sourceEvidence.responseSpan.start}–${sourceEvidence.responseSpan.end}` })}` : ''}` : '' })
                  : t('contentBrief.insufficientSignal', { terms: sourceEvidence.matchedTerms.length ? ` (${t('contentBrief.sharedTerms')}: ${sourceEvidence.matchedTerms.join(', ')})` : '' })}
            </p>}
            {treatment === 'unreviewed' && <p className="mt-1 text-[9px] text-amber-200">{t('contentBrief.unreviewedParagraph')}</p>}
            {assessment.unsupportedParagraphs.includes(paragraph) && <p className="mt-1 text-[9px] text-rose-200">{t('contentBrief.unsupportedParagraph')}</p>}
          </article>;
        })}
        {paragraphs.length === 0 && <p className="py-3 text-center text-[10px] text-slate-600">{t('contentBrief.emptyParagraphs')}</p>}
        </div>
        {paragraphs.length > 500 && <p role="alert" className="mt-2 text-[9px] text-rose-200">{t('contentBrief.paragraphLimit')}</p>}
        {assessment.unreviewedParagraphs.length > 0 && <p className="mt-2 text-[9px] text-amber-200">{t('contentBrief.unreviewedCount', { count: assessment.unreviewedParagraphs.length })}</p>}
      </section>
  );
};
