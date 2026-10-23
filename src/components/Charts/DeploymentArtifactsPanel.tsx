import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import { downloadBlob } from '@/services/download';
import { buildDeploymentBundle, bundleToZip } from '@/services/deployArtifacts/bundle';
import type { RedirectRule } from '@/services/deployArtifacts/types';

interface Props { rules: RedirectRule[]; }

const button = 'rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-100 hover:bg-emerald-500/20';

/** One-click 301/410 export: .htaccess, Nginx, Cloudflare Bulk Redirects CSV, WordPress Redirection and a ZIP of all. */
export const DeploymentArtifactsPanel = ({ rules }: Props) => {
  const { t } = useTranslation();
  const bundle = useMemo(() => buildDeploymentBundle(rules), [rules]);
  if (!rules.length) return <p className="rounded-md border border-dashed border-slate-800 p-4 text-center text-xs text-slate-500">{t('executionCard.deploy.empty')}</p>;
  return <section aria-label={t('executionCard.deploy.aria')} className="rounded-xl border border-slate-800 bg-slate-900/45 p-4">
    <h4 className="text-sm font-semibold text-slate-100">{t('executionCard.deploy.title')} <HelpTip id="executionCard.deploy" /></h4>
    <p className="mt-1 text-[11px] text-slate-500">{t('executionCard.deploy.summary', { count: bundle.ruleCount })}</p>
    <div className="mt-3 flex flex-wrap gap-2">
      {bundle.files.map((file) => <button key={file.name} type="button" className={button} onClick={() => downloadBlob(file.name, new Blob([file.content], { type: 'text/plain;charset=utf-8' }))}>{file.name}</button>)}
      <button type="button" className={button} onClick={() => downloadBlob('seomi-redirects.zip', new Blob([bundleToZip(bundle) as BlobPart], { type: 'application/zip' }))}>{t('executionCard.deploy.zip')}</button>
    </div>
    {bundle.issues.length > 0 && <ul role="list" aria-label={t('executionCard.deploy.issuesAria')} className="mt-3 space-y-1 text-[10px] text-amber-200">
      {bundle.issues.map((issue, index) => <li key={`${issue.kind}-${issue.from}-${index}`} className="truncate font-mono" title={issue.from}>{t(`executionCard.deploy.issue.${issue.kind}`)}: {issue.from}</li>)}
    </ul>}
  </section>;
};
