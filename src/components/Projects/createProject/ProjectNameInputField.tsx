import React from 'react';
import { useTranslation } from 'react-i18next';

interface ProjectNameInputFieldProps {
  name: string;
  onChange: (value: string) => void;
  nameInputRef: React.RefObject<HTMLInputElement | null>;
  validationError?: string;
  isInvalid: boolean;
}

export const ProjectNameInputField: React.FC<ProjectNameInputFieldProps> = ({
  name,
  onChange,
  nameInputRef,
  validationError,
  isInvalid,
}) => {
  const { t } = useTranslation();

  return (
    <label className="block text-xs font-medium text-slate-300">
      {t('projects.name')}
      <input
        ref={nameInputRef}
        value={name}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={isInvalid}
        aria-describedby={isInvalid ? 'create-project-name-error' : undefined}
        required
        maxLength={80}
        placeholder={t('projects.namePlaceholder')}
        className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-400"
      />
      {validationError && isInvalid && (
        <span
          id="create-project-name-error"
          role="alert"
          className="mt-2 block text-xs text-rose-300"
        >
          {validationError}
        </span>
      )}
    </label>
  );
};
