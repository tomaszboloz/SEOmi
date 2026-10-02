import React from 'react';
import { cell } from '../crawlResultsHelpers';
import type { CrawledHtmlValidationFinding } from '@/types';
import type { Session, FilteredValidationPage } from './validationTabTypes';
import { ValidationFindingItem } from './ValidationFindingItem';

interface ValidationPageRowProps {
  item: FilteredValidationPage;
  t: Session['t'];
}

export const ValidationPageRow: React.FC<ValidationPageRowProps> = ({ item, t }) => {
  const { page, findings } = item;

  const detectedCharsetLabel =
    page.detected_charset ||
    (page.body_truncated ? t('crawlDeepUi.bodyTruncated') : t('crawlDeepUi.noData'));

  return (
    <tr className="border-t border-slate-800/80 align-top text-slate-300">
      <td className={`${cell} max-w-72 break-all font-mono`} title={page.url}>
        {page.url}
      </td>
      <td className={`${cell} font-mono`}>{page.charset || t('crawlDeepUi.notDeclared')}</td>
      <td className={`${cell} font-mono`}>{detectedCharsetLabel}</td>
      <td className={cell}>
        {findings.length ? (
          <details open>
            <summary className="cursor-pointer text-amber-200">
              {t('crawlDeepUi.findingCountShort', { count: findings.length })}
              {page.html_validation_truncated ? t('crawlDeepUi.limitedResult') : ''}
            </summary>
            <ul className="mt-2 max-w-2xl space-y-2">
              {findings.map((finding: CrawledHtmlValidationFinding, index: number) => (
                <ValidationFindingItem
                  key={`${finding.code}-${index}`}
                  finding={finding}
                  t={t}
                />
              ))}
            </ul>
          </details>
        ) : page.html_validation_findings ? (
          t('crawlDeepUi.noLocalRuleFindings')
        ) : (
          t('crawlDeepUi.legacySnapshotNoData')
        )}
        {page.html_validation_truncated && (
          <p className="mt-1 text-[10px] text-amber-300">
            {t('crawlDeepUi.validationTruncatedNote')}
          </p>
        )}
      </td>
    </tr>
  );
};
