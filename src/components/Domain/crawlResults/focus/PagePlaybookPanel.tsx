import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildBriefPrompt, buildPagePlaybook, buildRewriteBrief } from '@/services/siteFocus';
import type { PageFocus, SiteFocusReport } from '@/services/siteFocus';
import { BriefCardButton } from '@/components/Charts/BriefCardButton';
import { AddTaskButton } from '@/components/Charts/OptimizationTaskTracker';
import { codeDetail, codeText, codeTitle } from './focusText';

type CopyState = 'idle' | 'copied' | 'failed';

export const PagePlaybookPanel = ({ page, report, projectId, baselineScore }: { page: PageFocus; report: SiteFocusReport; projectId?: string | null; baselineScore?: number | null }) => {
  const { t } = useTranslation();
  const [copy, setCopy] = useState<CopyState>('idle');
  const playbook = buildPagePlaybook(page, report.pages, report.score, report.coreTopic);
  const brief = page.playbook === 'C' ? undefined : buildRewriteBrief(page, report.coreTopic);

  const copyPrompt = async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopy('copied');
    } catch {
      setCopy('failed');
    }
  };

  return (
    <section aria-labelledby="focus-playbook-title" className="space-y-3">
      <h3 id="focus-playbook-title" className="text-sm font-semibold text-slate-200">
        {t('focus.playbook.title')} <span className="text-xs font-normal text-slate-400">({t(`focus.playbook.type${playbook.playbook}`)})</span>
      </h3>
      <ul aria-label={t('focus.playbook.options')} className="space-y-2">
        {playbook.options.map((option) => (
          <li key={option.code} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-300">
            <p className="font-medium text-slate-100">{codeTitle(t, 'playbookOption', option.code, option.params)}</p>
            <p>{codeDetail(t, 'playbookOption', option.code, option.params)}</p>
            {option.expectedTrs && <p className="text-slate-400">{t('focus.playbook.potential', { min: option.expectedTrs.min, max: option.expectedTrs.max })}</p>}
            <p className="text-slate-400">{t('focus.effort', { min: option.effort.minHours, max: option.effort.maxHours })}</p>
          </li>
        ))}
      </ul>
      <ol aria-label={t('focus.playbook.steps')} className="list-decimal space-y-1 ps-5 text-xs text-slate-300">
        {playbook.steps.map((step) => <li key={step.code}>{codeText(t, 'playbookStep', step.code, step.params)}</li>)}
      </ol>
      {brief && (
        <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-300" data-testid="focus-brief">
          <h4 className="font-semibold text-slate-100">{t('focus.brief.title')}</h4>
          <p>{t('focus.brief.target', { target: brief.targetTrs, current: brief.currentTrs })}</p>
          <p><strong>{t('focus.brief.mustInclude')}:</strong> {brief.mustInclude.join(', ') || t('focus.detail.none')}</p>
          <p><strong>{t('focus.brief.avoid')}:</strong> {brief.avoid.join(', ') || t('focus.detail.none')}</p>
          <p><strong>{t('focus.brief.headings')}:</strong> {brief.headingSeeds.map((group) => group.join(' / ')).join('; ') || t('focus.detail.none')}</p>
          <p>{t('focus.brief.words', { min: brief.wordCount.min, max: brief.wordCount.max })}</p>
          {projectId && brief.mustInclude.length > 0 && <AddTaskButton projectId={projectId} task={{ kind: 'add-entities', module: 'sfs', url: page.url, requiredEntities: brief.mustInclude, baselineScore: baselineScore ?? null }} />}
          <BriefCardButton input={{ origin: 'sfs', title: page.url, sourceUrl: page.url, missingEntities: brief.mustInclude }} />
          <button type="button" onClick={() => void copyPrompt(buildBriefPrompt(brief))} className="rounded border border-slate-600 px-2 py-1 text-slate-100 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
            {t('focus.brief.copy')}
          </button>
          <p role="status" className="min-h-4 text-emerald-300">
            {copy === 'copied' ? t('focus.brief.copied') : copy === 'failed' ? t('focus.brief.copyFailed') : ''}
          </p>
        </div>
      )}
    </section>
  );
};
