import React from 'react';
import type { TFunction } from 'i18next';
import type { CrawledPageSummary } from '@/types';

interface CrawlPageTechnicalMetaProps {
  page: CrawledPageSummary;
  t: TFunction;
}

export const CrawlPageTechnicalMeta: React.FC<CrawlPageTechnicalMetaProps> = ({ page, t }) => {
  const contentHashLabel = page.content_hash
    ? `${page.word_count} ${t('siteAudit.words')} · ${t('siteAudit.contentHash')} ${page.content_hash.slice(0, 12)}…${
        page.content_simhash ? ` · ${t('siteAudit.simHash')} ${page.content_simhash}` : ''
      }`
    : t('siteAudit.contentUnavailable');

  const linksLabel = t('siteAudit.linkCounts', {
    internal: page.internal_link_count,
    external: page.external_link_count,
    checked: page.links.filter((l) => l.is_internal && l.target_http_status !== undefined).length,
  });

  const imagesLabel = t('siteAudit.imageCounts', {
    total: page.images.length,
    lazy: page.images.filter((img) => img.lazy_loaded).length,
  });

  const schemaLabel = page.schema_types.length
    ? `${page.schema_types.join(', ')}${
        page.schema_syntax_errors
          ? ` · ${t('siteAudit.schemaErrors', { count: page.schema_syntax_errors })}`
          : ''
      }`
    : t('siteAudit.notDetected');

  const metaRows: Array<[string, React.ReactNode]> = [
    [t('siteAudit.detailTitle'), `${page.title || t('siteAudit.none')}${page.title_length !== undefined ? ` · ${page.title_length} ${t('siteAudit.characters')}` : ''}`],
    [t('siteAudit.detailMetaDescription'), `${page.meta_description || t('siteAudit.none')}${page.meta_description_length !== undefined ? ` · ${page.meta_description_length} ${t('siteAudit.characters')}` : ''}`],
    [t('siteAudit.detailCanonical'), page.canonical || t('siteAudit.none')],
    [t('siteAudit.detailMetaRobots'), page.meta_robots || t('siteAudit.noDeclaration')],
    [t('siteAudit.xRobotsTag'), page.x_robots_tag || t('siteAudit.noDeclaration')],
    [t('siteAudit.detailIndexability'), page.indexability_status],
    [t('siteAudit.contentType'), page.content_type || t('siteAudit.unknown')],
    [t('siteAudit.detailResponseBody'), page.body_truncated ? t('siteAudit.truncatedBody') : t('siteAudit.completeBody')],
    [t('siteAudit.detailContent'), contentHashLabel],
    [t('siteAudit.detailLinks'), linksLabel],
    [t('siteAudit.detailImages'), imagesLabel],
    [t('siteAudit.schema'), schemaLabel],
    [t('siteAudit.language'), page.document_language || t('siteAudit.noHtmlLanguage')],
    [t('siteAudit.hreflang'), page.hreflangs.length ? page.hreflangs.map((i) => i.language).join(', ') : t('siteAudit.none')],
    [t('siteAudit.amp'), page.amp_url || t('siteAudit.none')],
  ];

  return (
    <dl className="mb-3 grid gap-x-6 gap-y-1 rounded-md border border-slate-800 bg-slate-900/60 p-3 text-[11px] text-slate-400 sm:grid-cols-2">
      {metaRows.map(([label, value], i) => (
        <div key={i}>
          <dt className="inline text-slate-500">{label}: </dt>
          <dd className="inline break-all text-slate-300">{value}</dd>
        </div>
      ))}
    </dl>
  );
};
