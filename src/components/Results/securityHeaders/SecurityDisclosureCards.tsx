import React from 'react';
import { AlertTriangle, EyeOff, Server } from 'lucide-react';
import type { TFunction } from 'i18next';

interface SecurityDisclosureCardsProps {
  serverHeader: string | undefined;
  xPoweredBy: string | undefined;
  t: TFunction;
}

export const SecurityDisclosureCards: React.FC<SecurityDisclosureCardsProps> = ({
  serverHeader,
  xPoweredBy,
  t,
}) => {
  const hasServerVersionLeak = Boolean(
    serverHeader &&
      serverHeader.split('/').length > 1 &&
      serverHeader.split('/')[1].split('').some((c) => !isNaN(parseInt(c, 10))),
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Server Version Disclosure */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Server className="w-4 h-4 text-slate-400" />
            <h4 className="text-xs font-semibold text-white">
              {t('legacyUi.security.serverHeader')}
            </h4>
          </div>
          {hasServerVersionLeak ? (
            <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 flex items-center space-x-1">
              <AlertTriangle className="w-3 h-3" />
              <span>{t('legacyUi.security.versionLeaked')}</span>
            </span>
          ) : serverHeader ? (
            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {t('legacyUi.security.bannerHardened')}
            </span>
          ) : (
            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {t('legacyUi.security.hiddenSuppressed')}
            </span>
          )}
        </div>
        <div className="bg-slate-950 p-2 rounded border border-slate-800 font-mono text-xs text-slate-300">
          {serverHeader ? (
            serverHeader
          ) : (
            <span className="text-slate-500 italic">{t('legacyUi.security.noServer')}</span>
          )}
        </div>
        {hasServerVersionLeak && (
          <p className="text-[11px] text-amber-400 mt-2">
            {t('legacyUi.security.serverWarning')}
          </p>
        )}
      </div>

      {/* X-Powered-By Disclosure */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <EyeOff className="w-4 h-4 text-slate-400" />
            <h4 className="text-xs font-semibold text-white">
              {t('legacyUi.security.poweredByHeader')}
            </h4>
          </div>
          {xPoweredBy ? (
            <span className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 flex items-center space-x-1">
              <AlertTriangle className="w-3 h-3" />
              <span>{t('legacyUi.security.stackLeaked')}</span>
            </span>
          ) : (
            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {t('legacyUi.security.safeNotExposed')}
            </span>
          )}
        </div>
        <div className="bg-slate-950 p-2 rounded border border-slate-800 font-mono text-xs text-slate-300">
          {xPoweredBy ? (
            <span className="text-rose-300">{xPoweredBy}</span>
          ) : (
            <span className="text-emerald-400 italic">
              {t('legacyUi.security.noPoweredBy')}
            </span>
          )}
        </div>
        {xPoweredBy && (
          <p className="text-[11px] text-rose-400 mt-2">
            {t('legacyUi.security.poweredByWarning')}
          </p>
        )}
      </div>
    </div>
  );
};
