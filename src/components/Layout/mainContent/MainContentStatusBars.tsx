import { Loader2, AlertCircle, X } from "lucide-react";
import { useAuditStore } from "@/stores/auditStore";

interface MainContentStatusBarsProps {
  isLoading: boolean;
  error: string | null;
  t: (key: string, params?: Record<string, unknown>) => string;
}

export const MainContentStatusBars = ({
  isLoading,
  error,
  t,
}: MainContentStatusBarsProps) => (
  <>
    {isLoading && (
      <div className="sticky top-0 z-40 w-full bg-emerald-950/80 border-b border-emerald-500/30 px-4 py-2 flex items-center justify-between text-xs text-emerald-300 backdrop-blur-md animate-in fade-in">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
          <span className="font-medium">
            {t("app.loading")} — {t("mainContent.loadingDetails")}
          </span>
        </div>
        <div className="w-24 h-1.5 bg-emerald-900 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-400 rounded-full animate-[pulse_1s_infinite] w-3/4" />
        </div>
      </div>
    )}

    {error && (
      <div className="sticky top-0 z-40 w-full bg-rose-950/90 border-b border-rose-500/30 px-4 py-2.5 flex items-center justify-between text-xs text-rose-300 backdrop-blur-md">
        <div className="flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
        <button
          type="button"
          onClick={() => useAuditStore.setState({ error: null })}
          aria-label={t("mainContent.dismissError")}
          className="p-1 hover:bg-rose-900/50 rounded text-rose-400 hover:text-white"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )}
  </>
);
