import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTrust } from '@/hooks/useTrust';
import { prefillFromAuthor, type AuthorEntity, type TrustJsonLdInput } from '@/services/eeatTrust';
import { nodesOf } from '@/services/eeatTrust/graph';
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
  const { report, previous } = useTrust(pages, startUrl, run, projectId);
  const [form, setForm] = useState<TrustJsonLdInput | null>(null);
  if (!report) return <Empty>{t('trust.empty')}</Empty>;
  const observed = { '@graph': pages.flatMap((page) => nodesOf(page).map((node) => ({
    ...(node.id ? { '@id': node.id } : {}),
    ...(node.types.length ? { '@type': node.types.length === 1 ? node.types[0] : node.types } : {}),
    ...(node.name ? { name: node.name } : {}),
    ...Object.fromEntries(Object.entries(node.props).map(([key, values]) => [key, values.length === 1 ? values[0] : values])),
  }))) };
  const open = (author: AuthorEntity) => setForm(prefillFromAuthor(author, report, startUrl));
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">{t('trust.subtitle')}</p>
      <TrustHero report={report} previous={previous} />
      <TrustFindings findings={report.findings} />
      <div className="grid gap-4 lg:grid-cols-2">
        <TrustEntities report={report} onGenerate={open} />
        <TrustSignals report={report} />
      </div>
      {form && <TrustJsonLdGenerator key={form.personName + form.pageUrl} initial={form} observed={observed} onClose={() => setForm(null)} />}
    </div>
  );
};
