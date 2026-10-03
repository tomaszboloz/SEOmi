import type { TFunction } from 'i18next';
import type { CrawledImageResourceCheck } from '@/types';
import type { FlatCrawlImageItem } from './mediaTabTypes';
import { cell, formatNumber } from '../crawlResultsHelpers';

interface CrawlMediaImageRowProps {
  item: FlatCrawlImageItem;
  t: TFunction;
}

export const CrawlMediaImageRow: React.FC<CrawlMediaImageRowProps> = ({ item, t }) => {
  const { page, image } = item;
  const isError = image.request_error_kind || (image.http_status && image.http_status >= 400);

  return (
    <tr className="border-t border-slate-800/80 align-top text-slate-300">
      <td className={`${cell} max-w-52 truncate font-mono`} title={page.url}>
        {page.url}
      </td>
      <td className={`${cell} max-w-72 font-mono`} title={image.src}>
        <p className="truncate">{image.src}</p>
        {image.srcset_resource_checks?.length ? (
          <details className="mt-1">
            <summary className="cursor-pointer text-[10px] text-emerald-200">
              {t('uiUnits.srcsetVariants', { count: image.srcset_resource_checks.length })}
            </summary>
            <ul className="mt-1 space-y-1">
              {image.srcset_resource_checks.map((candidate: CrawledImageResourceCheck, index: number) => {
                const candidateError =
                  candidate.request_error_kind ||
                  (candidate.http_status && candidate.http_status >= 400);
                return (
                  <li key={`${candidate.url}-${index}`} className="break-all text-[10px]">
                    <span
                      className={
                        candidateError
                          ? 'text-rose-300'
                          : candidate.checked_in_run
                          ? 'text-emerald-300'
                          : 'text-slate-500'
                      }
                    >
                      {candidate.checked_in_run
                        ? candidate.http_status
                          ? t('crawl.ui.httpStatus', { status: candidate.http_status })
                          : candidate.request_error_kind || t('crawl.ui.checked')
                        : t('crawl.ui.notChecked')}
                    </span>
                    {candidate.content_length == null
                      ? ''
                      : ` · ${formatNumber(candidate.content_length)} B`}{' '}
                    · {candidate.url}
                  </li>
                );
              })}
            </ul>
            {image.srcset_resource_checks_truncated && (
              <p className="mt-1 text-amber-300">{t('crawl.ui.srcsetTruncated')}</p>
            )}
          </details>
        ) : (
          image.srcset && (
            <p className="mt-1 truncate text-[10px] text-slate-500" title={image.srcset}>
              {t('crawl.ui.srcsetNoVariants')}
            </p>
          )
        )}
      </td>
      <td
        className={`${cell} font-mono ${
          isError ? 'text-rose-300' : image.checked_in_run ? 'text-emerald-300' : 'text-slate-500'
        }`}
      >
        {!image.checked_in_run
          ? t('crawl.ui.notChecked')
          : image.http_status
          ? t('crawl.ui.httpStatus', { status: image.http_status })
          : image.request_error_kind || t('crawl.ui.noStatus')}
      </td>
      <td className={`${cell} text-right font-mono`}>
        {image.content_length === undefined || image.content_length === null
          ? '—'
          : `${formatNumber(image.content_length)} B`}
      </td>
      <td
        className={`${cell} max-w-48 truncate ${
          image.alt === undefined ? 'text-rose-300' : 'text-slate-300'
        }`}
      >
        {image.alt === undefined
          ? t('crawl.ui.missingAlt')
          : image.alt || t('crawl.ui.emptyAlt')}
      </td>
      <td className={cell}>{image.format || '—'}</td>
      <td className={`${cell} font-mono`}>
        {image.width || '—'} × {image.height || '—'}
        {image.dimensions_source && (
          <span className="ml-1 text-[10px] text-slate-500">
            ·{' '}
            {t(
              `crawl.ui.dimensionSources.${
                image.dimensions_source === 'intrinsic-data-uri'
                  ? 'dataUri'
                  : image.dimensions_source === 'intrinsic-http'
                  ? 'http'
                  : image.dimensions_source === 'mixed'
                  ? 'mixed'
                  : 'attributes'
              }`,
            )}
          </span>
        )}
      </td>
      <td className={cell}>
        {image.lazy_loaded ? t('crawl.ui.lazy') : t('crawl.ui.standard')}
      </td>
    </tr>
  );
};
