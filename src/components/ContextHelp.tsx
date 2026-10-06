import { CircleHelp } from 'lucide-react';
import type { ReactNode } from 'react';

interface ContextHelpProps {
  id: string;
  label: string;
  children: ReactNode;
}

/** A keyboard and screen-reader friendly explanation that stays beside a control. */
export const ContextHelp = ({ id, label, children }: ContextHelpProps) => (
  <details id={id} className="relative inline-flex align-middle">
    <summary
      aria-describedby={`${id}-description`}
      className="flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
    >
      <CircleHelp className="h-4 w-4" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </summary>
    <p id={`${id}-description`} role="note" className="absolute right-0 z-10 mt-1 w-72 rounded-lg border border-slate-700 bg-slate-950 p-3 text-left text-[11px] leading-4 text-slate-300 shadow-xl">
      {children}
    </p>
  </details>
);
