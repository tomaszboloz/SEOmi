import { useTranslation } from 'react-i18next';
import { aioLanguageStatusGroups, type AioReport } from '@/services/aioReadiness';

const UNDETERMINED = 'und';

/**
 * Honest language coverage note (#108): "uncertain" languages use basic word lists without a native
 * review; "unsupported" ones were scored with an English fallback. Older reports without per-page
 * status keep the previous single "basic rules" note.
 */
export const AioLanguageNote = ({ report }: { report: Pick<AioReport, 'pages' | 'basicRuleLanguages'> }) => {
  const { t } = useTranslation();
  const groups = aioLanguageStatusGroups(report);
  const name = (code: string): string => (code === UNDETERMINED ? t('aio.languageStatus.undetermined') : code);
  if (!groups) {
    return report.basicRuleLanguages.length > 0
      ? <p role="note" className="text-xs text-amber-200">{t('aio.basicNote', { languages: report.basicRuleLanguages.join(', ') })}</p>
      : null;
  }
  if (!groups.uncertain.length && !groups.unsupported.length) return null;
  return (
    <div role="note" className="space-y-1 text-xs text-amber-200" data-testid="aio-language-note">
      {groups.uncertain.length > 0 && <p>{t('aio.languageStatus.uncertain', { languages: groups.uncertain.map(name).join(', ') })}</p>}
      {groups.unsupported.length > 0 && <p>{t('aio.languageStatus.unsupported', { languages: groups.unsupported.map(name).join(', ') })}</p>}
    </div>
  );
};
