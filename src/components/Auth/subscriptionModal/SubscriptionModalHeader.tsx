import React from 'react';
import { ShieldCheck, X } from 'lucide-react';
import type { TFunction } from 'i18next';

interface SubscriptionModalHeaderProps {
  onClose: () => void;
  t: TFunction;
}

export const SubscriptionModalHeader: React.FC<SubscriptionModalHeaderProps> = ({
  onClose,
  t,
}) => {
  return (
    <header className="flex items-start justify-between border-b border-slate-800 bg-slate-950/80 px-6 py-4">
      <div className="flex gap-3">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-emerald-400">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h3 id="ai-connections-title" className="text-base font-bold text-white">
            {t('auth.connectionsTitle')}
          </h3>
          <p className="mt-0.5 max-w-2xl text-xs leading-5 text-slate-400">
            {t('auth.connectionsDescription')}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={t('auth.closeConnections')}
        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </header>
  );
};
