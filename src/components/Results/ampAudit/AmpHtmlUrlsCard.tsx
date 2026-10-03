import React from 'react';
import type { TFunction } from 'i18next';

interface AmpHtmlUrlsCardProps {
  urls: string[];
  t: TFunction;
}

export const AmpHtmlUrlsCard: React.FC<AmpHtmlUrlsCardProps> = ({ urls, t }) => {
  if (urls.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <h3 className="mb-3 text-xs font-semibold text-slate-200">
        {t('ampUi.declaredAmpHtml')}
      </h3>
      <ul className="space-y-2">
        {urls.map((url) => (
          <li key={url} className="break-all font-mono text-xs text-slate-300">
            {url}
          </li>
        ))}
      </ul>
    </div>
  );
};
