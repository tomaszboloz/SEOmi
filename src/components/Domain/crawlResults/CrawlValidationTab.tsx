import React from 'react';
import { Empty } from './CrawlViewPrimitives';
import type { useCrawlResultsSession } from './useCrawlResultsSession';
import { useValidationFilter } from './validationTab/useValidationFilter';
import { ValidationFilterBar } from './validationTab/ValidationFilterBar';
import { ValidationTable } from './validationTab/ValidationTable';

type Session = ReturnType<typeof useCrawlResultsSession>;

export const CrawlValidationTab: React.FC<{ session: Session }> = ({ session }) => {
  const {
    result,
    setValidationQuery,
    setValidationSeverity,
    t,
    validationQuery,
    validationSeverity,
  } = session;

  const { checkedPages, validationPages, validationFindingCount } = useValidationFilter(
    result.pages,
    validationQuery,
    validationSeverity,
  );

  if (!checkedPages.length) {
    return <Empty>{t('crawlDeepUi.noValidationResults')}</Empty>;
  }

  return (
    <div className="space-y-3">
      <ValidationFilterBar
        validationQuery={validationQuery}
        setValidationQuery={setValidationQuery}
        validationSeverity={validationSeverity}
        setValidationSeverity={setValidationSeverity}
        pagesCount={validationPages.length}
        findingsCount={validationFindingCount}
        t={t}
      />

      <p className="text-[11px] leading-5 text-slate-500">
        {t('crawlDeepUi.htmlValidationNote')}
      </p>

      <ValidationTable validationPages={validationPages} t={t} />
    </div>
  );
};
