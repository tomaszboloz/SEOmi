import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTrust } from '@/hooks/useTrust';
import { nativeRegistryFetcher, prefillFromAuthor, verifyProfile, type AuthorEntity, type ProfileEvidence, type TrustJsonLdInput } from '@/services/eeatTrust';
import type { CrawledPageSummary, CrawlRunRecord } from '@/types';
import { Empty } from '../CrawlViewPrimitives';
import { TrustEntities } from './TrustEntities';
import { TrustFindings } from './TrustFindings';
import { TrustHero } from './TrustHero';
import { TrustJsonLdGenerator } from './TrustJsonLdGenerator';
import { TrustSignals } from './TrustSignals';

export interface CrawlTrustTabProps {
  pages: CrawledPageSummary[];
  startUrl: string;
  run?: CrawlRunRecord | null;
  projectId?: string | null;
}

export const CrawlTrustTab = ({ pages, startUrl, run, projectId }: CrawlTrustTabProps) => {
  const { t } = useTranslation();
  const [profileEvidence, setProfileEvidence] = useState<Record<string, ProfileEvidence>>({});
  const { report, previous } = useTrust(pages, startUrl, run, projectId, profileEvidence);
  const [form, setForm] = useState<TrustJsonLdInput | null>(null);
  if (!report) return <Empty>{t('trust.empty')}</Empty>;
  const open = (author: AuthorEntity) => setForm(prefillFromAuthor(author, report, startUrl));
  const verify = async (author: AuthorEntity) => {
    const entries = await Promise.all(author.profiles.map(async (profile) => [profile.url, (await verifyProfile(profile, { fetcher: nativeRegistryFetcher })).profile] as const));
    setProfileEvidence((current) => ({ ...current, ...Object.fromEntries(entries) }));
  };
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">{t('trust.subtitle')}</p>
      <TrustHero report={report} previous={previous} />
      <TrustFindings findings={report.findings} />
      <div className="grid gap-4 lg:grid-cols-2">
      <TrustEntities report={report} onGenerate={open} onVerify={verify} />
        <TrustSignals report={report} />
      </div>
      {form && <TrustJsonLdGenerator key={form.personName + form.pageUrl} initial={form} onClose={() => setForm(null)} />}
    </div>
  );
};
