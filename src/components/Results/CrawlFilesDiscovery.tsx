import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, ExternalLink } from 'lucide-react';
import type { PageAuditData } from '@/types';

export const CrawlFilesDiscovery: React.FC<{ audit: PageAuditData }> = ({ audit }) => {
  const { t } = useTranslation();
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
      <div className="flex items-center space-x-2 mb-4">
        <FileText className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-bold text-white">{t('performance.crawlingDiscovery')}</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        {/* Robots.txt */}
        <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <span className="font-semibold text-white block mb-0.5">{t('performance.robotsLocation')}</span>
            <span className="font-mono text-slate-400 truncate block">
              {audit.technical.robots_txt_url}
            </span>
          </div>
          {audit.technical.robots_txt_url && (
            <a
              href={audit.technical.robots_txt_url}
              target="_blank"
              rel="noreferrer"
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition shrink-0"
              title={t('performance.openRobots')}
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        {/* Sitemap.xml */}
        <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <span className="font-semibold text-white block mb-0.5">{t('performance.sitemapLocation')}</span>
            <span className="font-mono text-slate-400 truncate block">
              {audit.technical.sitemap_url}
            </span>
          </div>
          {audit.technical.sitemap_url && (
            <a
              href={audit.technical.sitemap_url}
              target="_blank"
              rel="noreferrer"
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition shrink-0"
              title={t('performance.openSitemap')}
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
