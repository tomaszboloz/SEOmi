import type { TFunction } from 'i18next';
import type { AltVerdict } from '@/services/multimodal';

export const CrawlImageAltQuality = ({ verdict, t }: { verdict: AltVerdict; t: TFunction }) => (
  <div className="flex flex-wrap gap-1 text-[11px]">
    {verdict.issues.length > 0 ? verdict.issues.map((issue) => (
      <span key={issue} className="rounded bg-amber-950/40 px-1.5 py-0.5 text-amber-200">
        {t(`altCheckUi.issues.${issue}`)}
      </span>
    )) : (
      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">
        {t(verdict.role === 'decorative' ? 'altCheckUi.decorative' : 'altCheckUi.noIssues')}
      </span>
    )}
  </div>
);
