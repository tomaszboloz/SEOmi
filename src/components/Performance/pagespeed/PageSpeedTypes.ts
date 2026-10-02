import { CruxFormFactor, PageSpeedStrategy } from "@/services/pagespeed";
import { PageSpeedSnapshot } from "@/services/pagespeedHistory";

export interface PageSpeedConfigProps {
  session: {
    url: string;
    strategy: PageSpeedStrategy;
    formFactor: CruxFormFactor;
    scope: "url" | "origin";
  };
  updateSession: (updates: Partial<any>) => void;
  isRunningPsi: boolean;
  isRunningCrux: boolean;
  psiError: string | null;
  cruxError: string | null;
  runPsi: () => Promise<void>;
  runCrux: () => Promise<void>;
  hasApiKey: boolean;
}

export interface HistoryChartsProps {
  chronologicalHistory: PageSpeedSnapshot[];
  latestSnapshot: PageSpeedSnapshot | null;
}

export interface HistoryComparisonProps {
  history: PageSpeedSnapshot[];
  compareId: string;
  setCompareId: (id: string) => void;
  latestSnapshot: PageSpeedSnapshot | null;
  comparison: any | null;
}

export interface HistoryTableProps {
  history: PageSpeedSnapshot[];
}

export interface HistorySectionProps {
  history: PageSpeedSnapshot[];
  setHistory: (history: PageSpeedSnapshot[]) => void;
  compareId: string;
  setCompareId: (id: string) => void;
  activeProjectId: string | null;
  latestSnapshot: PageSpeedSnapshot | null;
  chronologicalHistory: PageSpeedSnapshot[];
  comparison: any | null;
}

export interface LabSectionProps {
  psiReport: any;
}

export interface FieldSectionProps {
  crux: any;
  cruxMetrics: any;
  collectionPeriod: string | null;
}
