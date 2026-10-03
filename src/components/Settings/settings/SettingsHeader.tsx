import React from 'react';
import { useTranslation } from 'react-i18next';
import { Settings as SettingsIcon, X } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';

export const SettingsHeader: React.FC = () => {
  const { t } = useTranslation();
  const closeModal = useUIStore((s) => s.closeModal);

  return (
    <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
      <div className="flex items-center space-x-2.5">
        <div className="p-2 rounded-lg bg-slate-800 text-slate-300">
          <SettingsIcon className="w-5 h-5" />
        </div>
        <div>
          <h3 id="settings-modal-title" className="text-sm font-bold text-white">{t('sidebar.settings')}</h3>
          <p id="settings-modal-description" className="text-[11px] text-slate-400">{t('legacyUi.settings.description')}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={closeModal}
        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
        aria-label={t('settings.close')}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
