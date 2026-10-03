import React from 'react';
import { useTranslation } from 'react-i18next';
import { FolderPlus, X } from 'lucide-react';

interface CreateProjectModalHeaderProps {
  onClose: () => void;
}

export const CreateProjectModalHeader: React.FC<CreateProjectModalHeaderProps> = ({ onClose }) => {
  const { t } = useTranslation();

  return (
    <header className="flex items-start justify-between border-b border-slate-800 bg-slate-950/70 px-5 py-4">
      <div className="flex gap-3">
        <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-2.5 text-emerald-300">
          <FolderPlus className="h-5 w-5" />
        </div>
        <div>
          <h2 id="create-project-title" className="text-base font-semibold text-white">
            {t('projects.newProject')}
          </h2>
          <p id="create-project-description" className="mt-0.5 text-xs leading-5 text-slate-400">
            {t('projects.dataDescription')}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
        aria-label={t('projects.closeCreate')}
      >
        <X className="h-4 w-4" />
      </button>
    </header>
  );
};
