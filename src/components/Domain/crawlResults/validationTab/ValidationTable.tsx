import React from 'react';
import { cell, tableHead } from '../crawlResultsHelpers';
import { Empty, Table } from '../CrawlViewPrimitives';
import type { Session, FilteredValidationPage } from './validationTabTypes';
import { ValidationPageRow } from './ValidationPageRow';

interface ValidationTableProps {
  validationPages: FilteredValidationPage[];
  t: Session['t'];
}

export const ValidationTable: React.FC<ValidationTableProps> = ({ validationPages, t }) => {
  if (!validationPages.length) {
    return <Empty>{t('crawl.ui.noHtmlFindings')}</Empty>;
  }

  const headers = [
    t('crawlDeepUi.sourceUrl'),
    t('crawlDeepUi.httpCharset'),
    t('crawlDeepUi.decoderCharset'),
    t('crawlDeepUi.localFindings'),
  ];

  return (
    <Table minWidth="min-w-[1100px]">
      <thead className={tableHead}>
        <tr>
          {headers.map((label) => (
            <th key={label} className={cell}>
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {validationPages.map((item) => (
          <ValidationPageRow key={item.page.url} item={item} t={t} />
        ))}
      </tbody>
    </Table>
  );
};
