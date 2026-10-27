import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LogMatrixRow } from './matrixView';

export const LogMatrixTable = ({ rows }: { rows: LogMatrixRow[] }) => {
  const { t: translate, i18n } = useTranslation();
  const [requestedPage, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(rows.length / 50));
  const page = Math.min(requestedPage, pageCount - 1);
  const percent = new Intl.NumberFormat(i18n.language, { style: 'percent', maximumFractionDigits: 1 });
  return <div className="space-y-2">
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{translate('logIntelUi.matrix')}</caption>
        <thead><tr>{['path', 'family', 'status', 'hits', 'errors', 'verdict'].map((key) =>
          <th key={key} scope="col" className="p-2">{translate(`logIntelUi.columns.${key}`)}</th>)}</tr></thead>
        <tbody>{rows.slice(page * 50, (page + 1) * 50).map((row) => <tr key={`${row.path}|${row.family}|${row.status}`} className="border-t border-slate-800">
          <td className="break-all p-2">{row.path}</td>
          <td className="p-2">{translate(`logIntelUi.families.${row.family ?? 'none'}`)}</td>
          <td className="p-2">{translate(`logIntelUi.statuses.${row.status}`)}</td>
          <td className="p-2">{row.hits === null ? translate('logIntelUi.unavailable') : row.hits.toLocaleString(i18n.language)}</td>
          <td className="p-2">{row.errorShare === null ? translate('logIntelUi.unavailable') : percent.format(row.errorShare)}</td>
          <td className="p-2">{translate(`logIntelUi.verdicts.${row.verdict}`)}</td>
        </tr>)}</tbody>
      </table>
      {!rows.length && <p className="p-2 text-slate-400">{translate('logIntelUi.empty')}</p>}
    </div>
    {pageCount > 1 && <nav aria-label={translate('logIntelUi.matrix')} className="flex items-center gap-3">
      <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>{translate('logIntelUi.previous')}</button>
      <span>{translate('logIntelUi.page', { current: page + 1, total: pageCount })}</span>
      <button type="button" disabled={page === pageCount - 1} onClick={() => setPage(page + 1)}>{translate('logIntelUi.next')}</button>
    </nav>}
  </div>;
};
