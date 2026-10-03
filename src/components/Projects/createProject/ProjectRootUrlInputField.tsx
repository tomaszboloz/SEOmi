import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe2 } from 'lucide-react';

interface ProjectRootUrlInputFieldProps {
  rootUrl: string;
  onChange: (value: string) => void;
  validationError?: string;
  isInvalid: boolean;
}

export const ProjectRootUrlInputField: React.FC<ProjectRootUrlInputFieldProps> = ({
  rootUrl,
  onChange,
  validationError,
  isInvalid,
}) => {
  const { t } = useTranslation();

  return (
    <label className="block text-xs font-medium text-slate-300">
      {t('projects.startingDomain')}{' '}
      <span className="font-normal text-slate-500">
        ({t('projects.optional')})
      </span>
      <span className="relative mt-2 block">
        <Globe2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={rootUrl}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={isInvalid}
          aria-describedby={isInvalid ? 'create-project-root-url-error' : undefined}
          maxLength={2048}
          placeholder={t('projects.startingDomainPlaceholder')}
          className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 py-0 pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-400"
        />
      </span>
      {validationError && isInvalid && (
        <span
          id="create-project-root-url-error"
          role="alert"
          className="mt-2 block text-xs text-rose-300"
        >
          {validationError}
        </span>
      )}
    </label>
  );
};
