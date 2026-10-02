import React from 'react';
import { FileDown, Image, LoaderCircle } from 'lucide-react';
import { format } from 'date-fns';
import type { TFunction } from 'i18next';
import type { RenderedPageArtifact } from '@/types';
import { downloadRenderedArtifact, formatNumber } from '../crawlResultsHelpers';

interface PerformanceArtifactsSectionProps {
  renderedArtifactUrl: string;
  renderedArtifactUrls: string[];
  setRenderedArtifactUrl: (url: string) => void;
  createRenderedArtifact: (kind: 'screenshot' | 'pdf') => void | Promise<void>;
  renderedArtifactKind: 'screenshot' | 'pdf' | null;
  renderedArtifactError: string | null;
  renderedArtifact: RenderedPageArtifact | null;
  t: TFunction;
}

export const PerformanceArtifactsSection: React.FC<PerformanceArtifactsSectionProps> = ({
  renderedArtifactUrl,
  renderedArtifactUrls,
  setRenderedArtifactUrl,
  createRenderedArtifact,
  renderedArtifactKind,
  renderedArtifactError,
  renderedArtifact,
  t,
}) => {
  return (
    <section
      aria-label={t('crawl.ui.renderedArtifacts')}
      className="rounded-lg border border-sky-500/25 bg-sky-500/5 p-4"
    >
      <div className="mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-sky-200">
          {t('crawlDeepUi.screenshotAndPdf')}
        </h3>
        <p className="mt-1 text-[11px] leading-5 text-slate-400">
          {t('crawlDeepUi.artifactDescription')}
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 text-[11px] text-slate-400">
          {t('crawlDeepUi.artifactUrl')}
          <select
            aria-label={t('crawl.ui.renderedUrlForArtifact')}
            value={renderedArtifactUrl}
            onChange={(event) => setRenderedArtifactUrl(event.target.value)}
            className="mt-1 block h-9 w-full min-w-0 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 outline-none focus:border-sky-400"
          >
            {renderedArtifactUrls.map((url) => (
              <option key={url} value={url}>
                {url}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={renderedArtifactKind !== null}
            onClick={() => void createRenderedArtifact('screenshot')}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-sky-400/40 bg-sky-400/10 px-3 text-xs font-medium text-sky-100 transition hover:border-sky-300/80 hover:bg-sky-400/20 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            {renderedArtifactKind === 'screenshot' ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Image className="h-3.5 w-3.5" />
            )}
            {t('crawlDeepUi.screenshot')}
          </button>
          <button
            type="button"
            disabled={renderedArtifactKind !== null}
            onClick={() => void createRenderedArtifact('pdf')}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-sky-400/40 bg-sky-400/10 px-3 text-xs font-medium text-sky-100 transition hover:border-sky-300/80 hover:bg-sky-400/20 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            {renderedArtifactKind === 'pdf' ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileDown className="h-3.5 w-3.5" />
            )}
            {t('crawlDeepUi.pagePdf')}
          </button>
        </div>
      </div>
      {renderedArtifactKind && (
        <p role="status" className="mt-2 text-[11px] text-sky-200">
          {t('crawlDeepUi.creatingArtifact', {
            kind:
              renderedArtifactKind === 'pdf'
                ? t('crawlDeepUi.pagePdf')
                : t('crawlDeepUi.screenshot'),
          })}
        </p>
      )}
      {renderedArtifactError && (
        <p role="alert" className="mt-2 break-words text-[11px] text-rose-300">
          {renderedArtifactError}
        </p>
      )}
      {renderedArtifact && (
        <div className="mt-3 flex flex-col gap-1 rounded-md border border-sky-500/20 bg-slate-950/50 p-3 text-[11px] text-slate-400 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
          <span className="text-sky-200">
            {t('crawl.ui.createdAndDownloaded')}
          </span>
          <span className="max-w-full truncate font-mono" title={renderedArtifact.finalUrl}>
            {renderedArtifact.finalUrl}
          </span>
          <span>
            {format(new Date(renderedArtifact.capturedAt), 'yyyy-MM-dd HH:mm:ss')}
          </span>
          <span>{t('exportUi.statuses.bytes', { value: formatNumber(renderedArtifact.bytes) })}</span>
          <span>{renderedArtifact.rendererPlatform}</span>
          <button
            type="button"
            onClick={() => downloadRenderedArtifact(renderedArtifact)}
            className="self-start text-sky-200 underline decoration-sky-400/50 underline-offset-2 hover:text-white sm:self-auto"
          >
            {t('crawlDeepUi.downloadAgain')}
          </button>
        </div>
      )}
    </section>
  );
};
