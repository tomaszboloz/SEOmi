import React from 'react';
import type { TFunction } from 'i18next';
import { Sparkles, X } from 'lucide-react';

interface Props {
  closeModal: () => void;
  t: TFunction;
}

export const AIAssistantModalHeader: React.FC<Props> = ({ closeModal, t }) => (
  <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
    <div className="flex items-center space-x-2.5">
      <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
        <Sparkles className="w-5 h-5" />
      </div>
      <div>
        <h3 id="ai-assistant-title" className="text-sm font-bold text-white">
          {t('ai.title')}
        </h3>
        <p id="ai-assistant-description" className="text-[11px] text-slate-400">
          {t('ai.description')}
        </p>
      </div>
    </div>

    <button
      type="button"
      onClick={closeModal}
      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
      aria-label={t('ai.close')}
    >
      <X className="w-4 h-4" />
    </button>
  </div>
);
