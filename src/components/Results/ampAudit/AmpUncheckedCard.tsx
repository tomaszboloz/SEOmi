import React from 'react';
import type { TFunction } from 'i18next';
import { Info } from 'lucide-react';

interface AmpUncheckedCardProps {
  unchecked: string[];
  t: TFunction;
}

export const AmpUncheckedCard: React.FC<AmpUncheckedCardProps> = ({ unchecked, t }) => {
  if (unchecked.length === 0) return null;

  return (
    <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
      <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold text-sky-100">
        <Info className="h-4 w-4" aria-hidden="true" />
        {t('ampUi.outOfScope')}
      </h3>
      <ul className="list-inside list-disc space-y-1 text-xs leading-5 text-sky-100/75">
        {unchecked.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
};
