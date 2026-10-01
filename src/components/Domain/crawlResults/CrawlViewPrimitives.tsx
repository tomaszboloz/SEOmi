
import type { ReactNode } from "react";

import { tableWrap } from "./crawlResultsHelpers";
export const Empty = ({ children }: { children: string }) => (
  <p className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-8 text-center text-sm text-slate-500">
    {children}
  </p>
);

export const Table = ({
  children,
  minWidth = "min-w-[760px]",
}: {
  children: ReactNode;
  minWidth?: string;
}) => (
  <div className={tableWrap}>
    <table className={`w-full ${minWidth} text-left text-xs`}>{children}</table>
  </div>
);