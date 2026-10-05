import React from 'react';
import { Bot } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { BrandAiVisibilityReport } from '@/types';
import { getSentimentBadge } from './brandVisibilityTypes';
import { appLocale } from '@/services/localeFormat';

type BrandModelResponse = BrandAiVisibilityReport['models'][number];

interface AiBrandModelCardProps {
  model: BrandModelResponse;
  t: TFunction;
}

export const AiBrandModelCard: React.FC<AiBrandModelCardProps> = ({ model: m, t }) => {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col justify-between space-y-4 shadow-md">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-bold text-white text-sm flex items-center gap-2">
            <Bot className="w-4 h-4 text-emerald-400" />
            <span>{m.model_name}</span>
          </div>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase ${getSentimentBadge(
              m.sentiment,
            )}`}
          >
            {m.response_status === 'error'
              ? t('aiVisibility.brand.sentimentError')
              : m.sentiment === 'not_assessed'
              ? t('aiVisibility.brand.sentimentNotAssessed')
              : m.sentiment === 'positive'
              ? t('aiVisibility.brand.sentimentPositive')
              : m.sentiment === 'negative'
              ? t('aiVisibility.brand.sentimentNegative')
              : t('aiVisibility.brand.sentimentNeutral')}
          </span>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-slate-400">{t('aiVisibility.brand.brandMentioned')}</span>
            <span className="text-emerald-400 font-bold">
              {m.response_status === 'error'
                ? t('aiVisibility.brand.noResponse')
                : m.is_present
                ? t('aiVisibility.brand.mention')
                : t('aiVisibility.brand.noMention')}
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-400 rounded-full"
              style={{ width: `${m.response_status === 'error' ? 0 : m.is_present ? 100 : 0}%` }}
            />
          </div>
        </div>

        {m.prompt && (
          <p className="text-xs text-slate-400">
            {m.prompt} · {t('aiResearch.run', { count: m.repetition })}
          </p>
        )}
        {m.search_mode && (
          <p className="text-xs text-slate-400">
            {t(`aiResearch.${m.search_mode}`)} ·{' '}
            {t('aiResearch.position', { value: m.mention_position ?? '—' })} ·{' '}
            {t(m.own_domain_cited ? 'aiResearch.ownDomainYes' : 'aiResearch.ownDomainNo')}
          </p>
        )}
        {m.competitors_mentioned?.length ? (
          <p className="text-xs text-slate-400">{m.competitors_mentioned.join(', ')}</p>
        ) : null}
        {m.error_message ? (
          <p role="alert" className="text-xs text-rose-200 bg-rose-950/30 p-3 rounded-lg border border-rose-800/40">
            {m.error_message}
          </p>
        ) : (
          <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
            {m.summary}
          </p>
        )}
        <p className="text-[10px] text-slate-600">
          {t('aiVisibility.brand.savedResponse', {
            date: new Date(m.captured_at).toLocaleString(appLocale()),
            provider: m.provider,
          })}
        </p>
      </div>

      <div>
        <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5">
          {t('aiVisibility.brand.urlsLabel')}
        </div>
        <div className="flex flex-wrap gap-1">
          {m.cited_sources.map((src: string, i: number) => (
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              key={i}
              className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700/80"
            >
              {src}
            </a>
          ))}
          {!m.cited_sources.length && (
            <span className="text-[10px] text-slate-600">{t('aiVisibility.brand.noUrl')}</span>
          )}
        </div>
      </div>
    </div>
  );
};
