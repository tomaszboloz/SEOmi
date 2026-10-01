import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CrawledPageSummary } from '@/types';
import type { TopicalMapDocument } from '@/services/topicalMap';
import { generateSchemaGraph, SCHEMA_ARTICLE_TYPES, type SchemaArticleType } from '@/services/schemaGenerator';
import { copyText } from '@/services/clipboard';

interface Props {
  document: TopicalMapDocument;
  pages: CrawledPageSummary[];
  siteUrl: string;
  selectedUrl: string;
  includeOrganization: boolean;
  includeUrlBreadcrumbs: boolean;
  articleType: SchemaArticleType | '';
  onSelectedUrlChange: (url: string) => void;
  onIncludeOrganizationChange: (include: boolean) => void;
  onIncludeUrlBreadcrumbsChange: (include: boolean) => void;
  onArticleTypeChange: (type: SchemaArticleType | '') => void;
}

const normalizeUrl = (value: string) => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    url.hash = '';
    return url.href;
  } catch { return ''; }
};

export const SchemaGraphBuilder = ({ document, pages, siteUrl, selectedUrl, includeOrganization, includeUrlBreadcrumbs, articleType, onSelectedUrlChange, onIncludeOrganizationChange, onIncludeUrlBreadcrumbsChange, onArticleTypeChange }: Props) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const availablePages = useMemo(() => {
    const seen = new Set<string>();
    return pages.flatMap((page) => {
      const url = normalizeUrl(page.final_url || page.url);
      if (!url || seen.has(url)) return [];
      seen.add(url);
      return [{ url, title: page.title || url, description: page.meta_description || '', schemaTypes: page.schema_types ?? [] }];
    });
  }, [pages]);
  const normalizedSelected = normalizeUrl(selectedUrl);
  const page = availablePages.find((item) => item.url === normalizedSelected);
  const generated = page ? generateSchemaGraph({
    siteUrl,
    page,
    entity: document.entity,
    topicFacts: [],
    includeOrganization,
    includeUrlBreadcrumbs,
    articleType,
  }) : null;
  const json = generated ? JSON.stringify(generated.schema, null, 2) : '';
  const copy = async () => {
    try {
      const copied = await copyText(`<script type="application/ld+json">\n${json}\n</script>`);
      if (!copied) {
        setCopyError(true);
        return;
      }
      setCopied(true);
      setCopyError(false);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { setCopyError(true); }
  };

  return <section aria-label={t('schemaUi.sectionAria')} className="rounded-xl border border-slate-800 bg-slate-900/45 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h4 className="text-sm font-semibold text-slate-100">{t('schemaUi.title')}</h4><p className="mt-1 max-w-3xl text-[11px] leading-5 text-slate-500">{t('schemaUi.description')}</p></div>
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-2.5 py-2 text-[11px] text-slate-300"><input type="checkbox" checked={includeOrganization} onChange={(event) => onIncludeOrganizationChange(event.target.checked)} />{t('schemaUi.includeOrganization')}</label>
        <label className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-2.5 py-2 text-[11px] text-slate-300"><input type="checkbox" checked={includeUrlBreadcrumbs} onChange={(event) => onIncludeUrlBreadcrumbsChange(event.target.checked)} />{t('schemaUi.includeUrlBreadcrumbs')}</label>
      </div>
    </div>
    <label className="mt-4 block text-[11px] font-medium text-slate-400">{t('schemaUi.pageLabel')}
      <select aria-label={t('schemaUi.pageAria')} value={page?.url ?? ''} onChange={(event) => onSelectedUrlChange(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none focus:border-emerald-400">
        <option value="">{t('schemaUi.choosePage')}</option>
        {availablePages.map((item) => <option key={item.url} value={item.url}>{item.title} · {item.url}</option>)}
      </select>
    </label>
    {page && page.schemaTypes.some((type) => SCHEMA_ARTICLE_TYPES.some((allowed) => type.trim().split(/[/#:]/u).filter(Boolean).slice(-1)[0] === allowed)) ? <label className="mt-3 block text-[11px] font-medium text-slate-400">{t('schemaUi.detectedArticleType')}
      <select aria-label={t('schemaUi.articleTypeAria')} value={articleType} onChange={(event) => onArticleTypeChange(event.target.value as SchemaArticleType | '')} className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none focus:border-emerald-400">
        <option value="">{t('schemaUi.noArticleType')}</option>
        {SCHEMA_ARTICLE_TYPES.filter((allowed) => page.schemaTypes.some((type) => type.trim().split(/[/#:]/u).filter(Boolean).slice(-1)[0] === allowed)).map((type) => <option key={type} value={type}>{type}</option>)}
      </select>
    </label> : null}
    {!availablePages.length ? <p className="mt-3 rounded-md border border-dashed border-slate-700 p-3 text-xs text-slate-500">{t('schemaUi.noPages')}</p>
      : !page ? <p className="mt-3 rounded-md border border-dashed border-slate-700 p-3 text-xs text-slate-500">{t('schemaUi.chooseToPreview')}</p>
      : <>
        {generated?.omitted.length ? <ul aria-label={t('schemaUi.omittedFields')} className="mt-3 space-y-1 rounded-md border border-amber-500/20 bg-amber-500/5 p-3 text-[10px] text-amber-200">{generated.omitted.map((message) => <li key={message}>{message}</li>)}</ul> : null}
        <p className="mt-3 text-[10px] text-slate-500">{t('schemaUi.verifiedFacts', { count: generated?.usedVerifiedFacts ?? 0 })}</p>
        {includeUrlBreadcrumbs && <p className="mt-1 text-[10px] text-amber-200/80">{t('schemaUi.breadcrumbWarning')}</p>}
        {generated?.usedArticleType && <p className="mt-1 text-[10px] text-amber-200/80">{t('schemaUi.articleWarning', { type: generated.usedArticleType })}</p>}
        <div className="mt-3 flex items-center justify-between gap-3"><span className="text-[10px] font-medium text-slate-400">{t('schemaUi.structuredPreview')}</span><button type="button" onClick={() => void copy()} className="rounded-md border border-emerald-500/30 px-2.5 py-1.5 text-[10px] text-emerald-200 hover:bg-emerald-500/10">{copied ? t('schemaUi.copiedHtml') : t('schemaUi.copyScript')}</button></div>
        <pre className="mt-2 max-h-[480px] overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] leading-5 text-emerald-200">{json}</pre>
        {copyError && <p role="alert" className="mt-2 text-[10px] text-rose-300">{t('schemaUi.copyError')}</p>}
      </>}
  </section>;
};
