import React from 'react';
import type { TFunction } from 'i18next';
import type { CrawledPageSummary } from '@/types';
import { cell } from '../crawlResultsHelpers';
import { formatResourceStatus } from './CrawlSocialFaviconCell';

interface CrawlSocialMetaTagsCellProps {
  page: CrawledPageSummary;
  prefix: 'og:' | 'twitter:';
  t: TFunction;
}

export const CrawlSocialMetaTagsCell: React.FC<CrawlSocialMetaTagsCellProps> = ({
  page,
  prefix,
  t,
}) => {
  const tags = (page.social_meta_tags || []).filter((tag) => tag.key.startsWith(prefix));

  if (!tags.length) {
    return (
      <td className={cell}>
        <span className="text-slate-500">{t('crawl.social.noDeclaration')}</span>
      </td>
    );
  }

  return (
    <td className={cell}>
      <div className="max-w-[420px] space-y-2">
        {tags.map((tag, index) => (
          <div key={`${tag.key}-${index}`} className="break-words">
            <p>
              <span className="font-mono text-slate-500">{tag.key}: </span>
              {tag.content === undefined || tag.content === null ? (
                <span className="italic text-amber-300">{t('crawl.social.missingContent')}</span>
              ) : tag.content === '' ? (
                <span className="italic text-amber-300">{t('crawl.social.emptyContent')}</span>
              ) : (
                tag.content
              )}
            </p>
            {tag.resource_check && (
              <p className="mt-0.5 text-[10px] text-slate-500">
                {formatResourceStatus(tag.resource_check, t)}
              </p>
            )}
          </div>
        ))}
      </div>
    </td>
  );
};
