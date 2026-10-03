import React from 'react';
import type { TFunction } from 'i18next';
import type { HeaderSpec } from './securityHeadersTypes';
import { SecurityHeaderCard } from './SecurityHeaderCard';

interface SecurityHeadersListProps {
  totalCount: number;
  specs: HeaderSpec[];
  t: TFunction;
}

export const SecurityHeadersList: React.FC<SecurityHeadersListProps> = ({
  totalCount,
  specs,
  t,
}) => {
  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
        {t('legacyUi.security.defenseHeaders', { count: totalCount })}
      </h4>

      {specs.map((spec) => (
        <SecurityHeaderCard key={spec.key} spec={spec} t={t} />
      ))}
    </div>
  );
};
