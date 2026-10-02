import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PageAuditData } from '@/types';
import { analyzeKeyphrase } from '@/services/keyphraseAnalysis';
import { writeStorage } from '@/services/storage';

interface HeadingsKeyphraseSectionProps {
  audit: PageAuditData;
  keyphrase: string;
  setKeyphrase: (keyphrase: string) => void;
  savedKeyphraseKey: string | null;
}

export const HeadingsKeyphraseSection: React.FC<HeadingsKeyphraseSectionProps> = ({
  audit,
  keyphrase,
  setKeyphrase,
  savedKeyphraseKey,
}) => {
  const { t } = useTranslation();
  const keyphraseEvidence = analyzeKeyphrase(audit, keyphrase);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <label className="block text-xs font-medium text-slate-300">
        {t('legacyUi.headings.keyphrase')}{' '}
        <span className="font-normal text-slate-500">
          {t('legacyUi.headings.keyphraseOptional')}
        </span>
        <input
          value={keyphrase}
          onChange={(event) => {
            const next = event.target.value;
            setKeyphrase(next);
            if (savedKeyphraseKey) writeStorage(savedKeyphraseKey, next);
          }}
          placeholder={t('legacyUi.headings.keyphrasePlaceholder')}
          className="mt-2 h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
        />
      </label>
      {keyphrase.trim() && (
        <>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {keyphraseEvidence.map((item) => (
              <div
                key={item.field}
                className={`rounded-lg border p-3 ${
                  item.occurrences
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : 'border-amber-500/20 bg-amber-500/5'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-200">{item.label}</span>
                  <span
                    className={
                      item.occurrences
                        ? 'text-emerald-300 text-xs font-semibold'
                        : 'text-amber-300 text-xs font-semibold'
                    }
                  >
                    {item.occurrences}
                  </span>
                </div>
                <p
                  className="mt-1 truncate text-[11px] text-slate-400"
                  title={item.evidence[0]}
                >
                  {item.evidence[0] || t('legacyUi.headings.noOccurrence')}
                </p>
              </div>
            ))}
          </div>
          {audit.content_stats?.body_text_truncated && (
            <p className="mt-2 text-[11px] text-amber-300">{t('legacyUi.headings.truncated')}</p>
          )}
        </>
      )}
    </section>
  );
};
