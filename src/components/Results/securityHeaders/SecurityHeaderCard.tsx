import React from 'react';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { HeaderSpec } from './securityHeadersTypes';

interface SecurityHeaderCardProps {
  spec: HeaderSpec;
  t: TFunction;
}

export const SecurityHeaderCard: React.FC<SecurityHeaderCardProps> = ({ spec, t }) => {
  const isPresent = Boolean(spec.value);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div className="flex items-center space-x-2.5">
          {isPresent ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <h4 className="text-sm font-semibold text-white">{spec.title}</h4>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold uppercase ${
              spec.importance === 'Critical'
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
            }`}
          >
            {spec.importance === 'Critical'
              ? t('legacyUi.security.critical')
              : spec.importance === 'High'
              ? t('legacyUi.security.high')
              : t('legacyUi.security.medium')}
          </span>
        </div>

        <span
          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center self-start sm:self-auto ${
            isPresent
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
          }`}
        >
          {isPresent ? t('legacyUi.security.present') : t('legacyUi.security.missing')}
        </span>
      </div>

      {/* Header Value */}
      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs break-all mb-2">
        {spec.value ? (
          <span className="text-emerald-300">{spec.value}</span>
        ) : (
          <span className="text-slate-500 italic">{t('legacyUi.security.headerNotReturned')}</span>
        )}
      </div>

      {/* Remediation note */}
      <div className="flex items-start space-x-2 text-xs text-slate-400">
        <Info className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
        <p>
          <span className="text-slate-300 font-medium">{t('legacyUi.security.recommended')}</span>{' '}
          <code className="text-slate-200 bg-slate-800 px-1 rounded">{spec.expected}</code> —{' '}
          {spec.remediation}
        </p>
      </div>
    </div>
  );
};
