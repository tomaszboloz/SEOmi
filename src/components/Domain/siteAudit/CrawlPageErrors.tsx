import React from 'react';
import type { useSiteAuditSession } from './useSiteAuditSession';
import { CrawlPageErrorSummaryRow } from './pageErrors/CrawlPageErrorSummaryRow';
import { CrawlPageErrorExpandedRow } from './pageErrors/CrawlPageErrorExpandedRow';

type Session = ReturnType<typeof useSiteAuditSession>;

export const CrawlPageErrors: React.FC<{ session: Session }> = ({ session }) => {
  const { expandedRows, filteredPages, t, toggleRow } = session;

  return (
    <tbody className="divide-y divide-slate-800/60">
      {filteredPages.map((page) => {
        const isExpanded = Boolean(expandedRows[page.url]);
        return (
          <React.Fragment key={page.url}>
            <CrawlPageErrorSummaryRow
              page={page}
              isExpanded={isExpanded}
              onToggle={toggleRow}
              t={t}
            />
            {isExpanded && page.issues.length > 0 && (
              <CrawlPageErrorExpandedRow page={page} t={t} />
            )}
          </React.Fragment>
        );
      })}
    </tbody>
  );
};
