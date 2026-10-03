import React from 'react';
import type { TFunction } from 'i18next';
import type { CrawledImage } from '@/types';

interface CrawlPageImagesPreviewProps {
  images: CrawledImage[];
  t: TFunction;
}

export const CrawlPageImagesPreview: React.FC<CrawlPageImagesPreviewProps> = ({
  images,
  t,
}) => {
  if (!images.length) return null;

  return (
    <div className="mb-3 rounded-md border border-slate-800 bg-slate-900/50 p-3">
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {t('siteAudit.firstImages')}
      </p>
      {images.slice(0, 5).map((image) => (
        <p key={image.src} className="truncate text-[11px] text-slate-400">
          <span
            className={
              image.alt === undefined ? 'text-amber-300' : 'text-slate-500'
            }
          >
            {image.alt === undefined
              ? t('siteAudit.altMissing')
              : t('siteAudit.altValue', {
                  value: image.alt || t('siteAudit.empty'),
                })}
          </span>{' '}
          · {image.src}
        </p>
      ))}
    </div>
  );
};
