import React from 'react';
import { Wrench } from 'lucide-react';

interface SeoToolsPanelHeaderProps {
  title: string;
  description: string;
}

export const SeoToolsPanelHeader: React.FC<SeoToolsPanelHeaderProps> = ({
  title,
  description,
}) => (
  <header className="border-b border-slate-800 px-5 py-5 sm:px-7">
    <div className="flex items-start gap-3">
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-emerald-300">
        <Wrench className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">
          {description}
        </p>
      </div>
    </div>
  </header>
);
