import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { importPreviewPillars, previewTaxonomyMerge, type ReferenceTaxonomy } from '@/services/topicalAuthority';
import { readTopicalMap, writeTopicalMap } from '@/services/topicalMap';

export interface TaxonomyMergePreviewProps { taxonomy: ReferenceTaxonomy; projectId?: string | null }

/** Read-only comparison of the reference map with the project's hand-made pillars; adding new pillars is an explicit click. */
export const TaxonomyMergePreview = ({ taxonomy, projectId }: TaxonomyMergePreviewProps) => {
  const { t } = useTranslation();
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState('');
  if (!projectId) return null;
  const document = readTopicalMap(projectId);
  const manual = document.nodes.filter((node) => node.kind === 'pillar').map((node) => node.title);
  const preview = previewTaxonomyMerge(taxonomy, manual);
  const apply = () => {
    try {
      const next = importPreviewPillars(document, preview, taxonomy);
      writeTopicalMap(projectId, next);
      setNotice(t('authority.reference.merge.done', { count: next.nodes.length - document.nodes.length }));
    } catch (error) {
      setNotice(t('authority.reference.merge.failed', { error: error instanceof Error ? error.message : String(error) }));
    }
    setRevision(revision + 1);
  };
  return (
    <details key={revision} className="rounded-lg border border-slate-800 p-3 text-xs text-slate-300">
      <summary className="cursor-pointer font-semibold text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400">{t('authority.reference.merge.title')}</summary>
      <p className="mt-2 break-words text-slate-400">{t('authority.reference.merge.note')}</p>
      <ul className="mt-2 min-w-0 space-y-1 break-words">
        <li>{t('authority.reference.merge.matched', { count: preview.matched.length })}{preview.matched.map((item) => ` ${item.manual} (${item.subtopics})`).join(',')}</li>
        <li>{t('authority.reference.merge.added', { count: preview.added.length })}{preview.added.map((item) => ` ${item.label} (${item.subtopics})`).join(',')}</li>
        <li>{t('authority.reference.merge.manualOnly', { count: preview.manualOnly.length })}{preview.manualOnly.map((item) => ` ${item}`).join(',')}</li>
      </ul>
      <button type="button" disabled={!preview.added.length} onClick={apply} className="mt-2 rounded-lg border border-emerald-500/40 px-3 py-1 text-emerald-200 disabled:opacity-40">{t('authority.reference.merge.apply', { count: preview.added.length })}</button>
      {notice && <p role="status" className="mt-2 text-slate-300">{notice}</p>}
    </details>
  );
};
