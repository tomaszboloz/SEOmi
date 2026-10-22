import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { SubtopicCoverage, TopicalAuthorityReport } from '@/services/topicalAuthority';
import { GapBriefPanel } from './GapBriefPanel';
import { host, toneFor } from './authorityText';

const List = ({ title, items }: { title: string; items: string[] }) => (items.length ? (
  <div><h4 className="text-xs font-semibold text-slate-300">{title}</h4><ul className="list-disc space-y-0.5 ps-5 text-xs text-slate-300">{items.map((item) => <li key={item}>{item}</li>)}</ul></div>
) : null);

/** Per-sub-topic diagnosis: assigned page, entity and question gaps, internal-link audit, brief for gaps. */
export const SubtopicDrilldown = ({ report, row, onBack }: { report: TopicalAuthorityReport; row: SubtopicCoverage; onBack: () => void }) => {
  const { t } = useTranslation();
  const audit = row.bestUrl ? report.silo.audits[row.bestUrl] : undefined;
  const total = row.entitiesPresent.length + row.entitiesMissing.length;
  const issues: string[] = [];
  if (audit?.pillarUrl && !audit.linksToPillar) issues.push(t('authority.drill.noPillarLink', { url: host(audit.pillarUrl) }));
  if (audit && audit.inbound <= 1) issues.push(t('authority.drill.almostOrphan', { count: audit.inbound }));
  audit?.bleedTargets.forEach((target) => issues.push(t('authority.drill.bleed', { url: host(target) })));
  return (
    <section aria-labelledby="authority-drill-title" className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <header className="flex items-center justify-between gap-2">
        <h2 id="authority-drill-title" className="flex items-center gap-1 text-sm font-semibold text-slate-200">{t('authority.drill.title')}: {row.label} <HelpTip id="authority.esd" /></h2>
        <button type="button" onClick={onBack} className="rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-200">{t('authority.drill.back')}</button>
      </header>
      <p className="text-xs text-slate-400">{t(`authority.coverage.status.${row.status}`)}</p>
      {row.bestUrl ? (
        <>
          <p className="text-xs text-slate-300">{t('authority.drill.url')}: <code className="break-all">{host(row.bestUrl)}</code></p>
          <p className={`text-xs ${toneFor(row.depth ?? null)}`}>{row.depth === undefined ? '—' : t('authority.drill.depth', { value: row.depth })}</p>
          <List title={t('authority.drill.entitiesPresent', { count: row.entitiesPresent.length, total })} items={row.entitiesPresent} />
          <List title={t('authority.drill.entitiesMissing')} items={row.entitiesMissing} />
          <List title={t('authority.drill.questions')} items={row.questionsMissing} />
          <List title={t('authority.drill.links')} items={issues} />
          {audit && issues.length === 0 && <p className="text-xs text-emerald-300">{t('authority.drill.linksOk')}</p>}
        </>
      ) : <p className="text-xs text-rose-300">{t('authority.drill.none')}</p>}
      {row.coverage === 0 && <GapBriefPanel report={report} row={row} />}
    </section>
  );
};
