import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BotFamily } from '@/services/logIntelligence';
import type { VerificationSummary } from '@/services/logIntelligence/importer';
import { parsePublishedRanges, readPublishedRanges, savePublishedRanges } from '@/services/logIntelligence/publishedRanges';

const FAMILIES: BotFamily[] = ['gptbot', 'perplexitybot', 'googlebot', 'bingbot'];

/** Imported official IP ranges and how bot identities were checked (#92). Ranges apply to the next import. */
export const BotVerificationEvidence = ({ projectId, summary }: { projectId: string; summary?: VerificationSummary }) => {
  const { t, i18n } = useTranslation();
  const id = useId();
  const [family, setFamily] = useState<BotFamily>('gptbot');
  const [ranges, setRanges] = useState(() => readPublishedRanges(projectId));
  const [error, setError] = useState('');
  const load = async (file: File) => {
    const parsed = parsePublishedRanges(await file.text(), family, file.name);
    if (typeof parsed === 'string') { setError(parsed); return; }
    const saved = savePublishedRanges(projectId, parsed);
    setError(saved ? '' : 'storageFailed');
    if (saved) setRanges(saved);
  };
  const date = (value: number | string) => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value));
  return <div className="space-y-2 text-sm" data-testid="bot-verification-evidence">
    <h3 className="font-semibold">{t('logIntelUi.ranges.title')}</h3>
    <p className="text-slate-400">{t('logIntelUi.ranges.note')}</p>
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={`${id}-family`}>{t('logIntelUi.ranges.family')}</label>
      <select id={`${id}-family`} value={family} onChange={(event) => setFamily(event.currentTarget.value as BotFamily)}>
        {FAMILIES.map((item) => <option key={item} value={item}>{t(`logIntelUi.families.${item}`)}</option>)}
      </select>
      <label htmlFor={`${id}-file`}>{t('logIntelUi.ranges.file')}</label>
      <input id={`${id}-file`} type="file" accept=".json,application/json" onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (file) void load(file);
      }} />
    </div>
    {error && <p role="alert" className="text-amber-300">{t(`logIntelUi.ranges.errors.${error}`)}</p>}
    <ul>{ranges.map((item) => <li key={item.family}>
      {t('logIntelUi.ranges.loaded', { family: t(`logIntelUi.families.${item.family}`), count: item.cidrs.length, source: item.source, created: item.creationTime ?? t('logIntelUi.unavailable'), loaded: date(item.loadedAt) })}
    </li>)}</ul>
    <p>{summary && summary.checks > 0
      ? t('logIntelUi.ranges.summary', {
        checks: summary.checks, verified: summary.byStatus.verified, claimed: summary.byStatus.claimed, spoofed: summary.byStatus.spoofed,
        dns: summary.byMethod['reverse-forward-dns'], ranges: summary.byMethod['published-ranges'], none: summary.byMethod.none,
        time: summary.lastCheckedAt === null ? t('logIntelUi.unavailable') : date(summary.lastCheckedAt),
      })
      : t('logIntelUi.ranges.noChecks')}</p>
  </div>;
};
