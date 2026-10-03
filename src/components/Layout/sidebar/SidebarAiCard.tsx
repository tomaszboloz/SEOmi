import React from "react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";

export const SidebarAiCard: React.FC = () => {
  const { t } = useTranslation();
  const openModal = useUIStore((s) => s.openModal);
  const provider = useAuthStore((s) => s.provider);
  const isConnected = useAuthStore((s) => s.connectionStatus[s.provider] === "connected");
  const providerName =
    provider === "claude"
      ? "Claude"
      : provider === "openai"
        ? "OpenAI"
        : "Gemini";

  return (
    <div
      onClick={() => openModal("subscription")}
      className="p-2.5 rounded-xl bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 hover:border-emerald-500/40 transition cursor-pointer group"
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openModal("subscription");
        }
      }}
      aria-label={t("sidebar.aiConnection")}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-emerald-400" aria-hidden="true" />
          {isConnected
            ? `${providerName} ${t("sidebar.connected")}`
            : t("sidebar.aiConnection")}
        </span>
        <span
          className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${isConnected ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}
        >
          {isConnected ? t("sidebar.ready") : t("sidebar.connect")}
        </span>
      </div>
      <p className="text-[10px] text-slate-400 leading-tight">
        {isConnected
          ? t("sidebar.aiConnectionReady")
          : t("sidebar.aiConnectionPrompt")}
      </p>
    </div>
  );
};
