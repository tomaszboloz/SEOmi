import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  Bot,
  Check,
  Flame,
  KeyRound,
  Loader2,
  ShieldCheck,
  Sparkles,
  Terminal,
  X,
} from "lucide-react";
import { useUIStore } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";
import { AiProvider } from "@/types";

const providers: {
  id: AiProvider;
  nameKey: string;
  command: string;
  icon: React.ElementType;
  models: { id: string; labelKey: string }[];
  apiHelp: string;
}[] = [
  {
    id: "openai",
    nameKey: "legacyUi.ai.openai",
    command: "codex",
    icon: Bot,
    apiHelp: "https://platform.openai.com/api-keys",
    models: [
      { id: "gpt-4o", labelKey: "legacyUi.ai.gpt4o" },
      { id: "gpt-4o-mini", labelKey: "legacyUi.ai.gpt4oMini" },
      { id: "o3-mini", labelKey: "legacyUi.ai.o3Mini" },
    ],
  },
  {
    id: "claude",
    nameKey: "legacyUi.ai.claude",
    command: "claude",
    icon: Flame,
    apiHelp: "https://console.anthropic.com/settings/keys",
    models: [
      { id: "claude-opus-5", labelKey: "legacyUi.ai.claudeOpus5" },
      { id: "claude-sonnet-5", labelKey: "legacyUi.ai.claudeSonnet5" },
      { id: "claude-haiku-4-5", labelKey: "legacyUi.ai.claudeHaiku45" },
    ],
  },
  {
    id: "gemini",
    nameKey: "legacyUi.ai.gemini",
    command: "gemini",
    icon: Sparkles,
    apiHelp: "https://aistudio.google.com/app/apikey",
    models: [
      { id: "gemini-3.8-flash", labelKey: "legacyUi.ai.gemini38Flash" },
      { id: "gemini-3.5-flash-lite", labelKey: "legacyUi.ai.gemini35FlashLite" },
      { id: "gemini-3.1-pro-preview", labelKey: "legacyUi.ai.gemini31ProPreview" },
    ],
  },
];

export const SubscriptionModal: React.FC = () => {
  const { t } = useTranslation();
  const closeModal = useUIStore((s) => s.closeModal);
  const provider = useAuthStore((s) => s.provider);
  const model = useAuthStore((s) => s.model);
  const apiKeys = useAuthStore((s) => s.apiKeys);
  const methods = useAuthStore((s) => s.connectionMethod);
  const statuses = useAuthStore((s) => s.connectionStatus);
  const messages = useAuthStore((s) => s.statusMessages);
  const cliStatus = useAuthStore((s) => s.cliStatus);
  const setProvider = useAuthStore((s) => s.setProvider);
  const setModel = useAuthStore((s) => s.setModel);
  const setMethod = useAuthStore((s) => s.setConnectionMethod);
  const setApiKey = useAuthStore((s) => s.setApiKey);
  const testConnection = useAuthStore((s) => s.testProviderConnection);
  const detectLocalClients = useAuthStore((s) => s.detectLocalClients);
  const [saving, setSaving] = useState<AiProvider | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button, input, select, a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("disabled"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [closeModal]);

  useEffect(() => {
    void detectLocalClients();
  }, [detectLocalClients]);

  const saveKey = async (id: AiProvider, value: string) => {
    setSaving(id);
    try {
      await setApiKey(id, value);
    } catch {
      // The store records the translated keychain error in the provider row.
      // Keep this input handler settled so React never reports an unhandled
      // rejection while the user is typing.
    } finally {
      setSaving(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-connections-title"
        tabIndex={-1}
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl outline-none"
      >
        <header className="flex items-start justify-between border-b border-slate-800 bg-slate-950/80 px-6 py-4">
          <div className="flex gap-3">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3
                id="ai-connections-title"
                className="text-base font-bold text-white"
              >
                {t("auth.connectionsTitle")}
              </h3>
              <p className="mt-0.5 max-w-2xl text-xs leading-5 text-slate-400">
                {t("auth.connectionsDescription")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeModal}
            aria-label={t("auth.closeConnections")}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="space-y-4 overflow-y-auto p-6">
          {providers.map((item) => {
            const Icon = item.icon;
            const active = provider === item.id;
            const method = methods[item.id];
            const cli = cliStatus[item.id];
            const status = statuses[item.id];
            return (
              <section
                key={item.id}
                className={`rounded-2xl border p-5 ${active ? "border-emerald-500/40 bg-emerald-500/5" : "border-slate-800 bg-slate-950/50"}`}
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-2.5 text-emerald-400">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        {t(item.nameKey)}
                      </h4>
                      <p className="text-xs text-slate-400">
                        {t("auth.selectConnectionMethod")}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProvider(item.id)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${active ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-slate-700 bg-slate-800 text-slate-300 hover:text-white"}`}
                  >
                    {active ? (
                      <span className="flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        {t("auth.active")}
                      </span>
                    ) : (
                      t("auth.useProvider")
                    )}
                  </button>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setMethod(item.id, "local_cli")}
                    className={`rounded-xl border p-3 text-left ${method === "local_cli" ? "border-emerald-500/40 bg-emerald-500/10" : "border-slate-800 bg-slate-900/60"}`}
                  >
                    <span className="flex items-center gap-2 text-xs font-semibold text-white">
                      <Terminal className="h-3.5 w-3.5 text-emerald-400" />{" "}
                      {t("auth.localCliSubscription")}
                    </span>
                    <span className="mt-1 block text-[11px] leading-4 text-slate-400">
                      {t("auth.localCliDescription", { command: item.command })}{" "}
                      {cli?.available
                        ? `${t("auth.detected")}: ${cli.detail}`
                        : cli?.detail || t("auth.checkingAvailability")}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethod(item.id, "api_key")}
                    className={`rounded-xl border p-3 text-left ${method === "api_key" ? "border-emerald-500/40 bg-emerald-500/10" : "border-slate-800 bg-slate-900/60"}`}
                  >
                    <span className="flex items-center gap-2 text-xs font-semibold text-white">
                      <KeyRound className="h-3.5 w-3.5 text-emerald-400" />{" "}
                      {t("auth.directApiCredential")}
                    </span>
                    <span className="mt-1 block text-[11px] leading-4 text-slate-400">
                      {t("auth.apiDescription")}
                    </span>
                  </button>
                </div>
                {method === "api_key" && (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      aria-label={t("auth.apiKeyLabel", {
                        provider: t(item.nameKey),
                      })}
                      type="password"
                      value={apiKeys[item.id]}
                      onChange={(event) =>
                        void saveKey(item.id, event.target.value)
                      }
                      placeholder={t("auth.apiKeyPlaceholder")}
                      className="h-9 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 font-mono text-xs text-white"
                    />
                    <a
                      href={item.apiHelp}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-center text-xs text-emerald-300"
                    >
                      {t("auth.manageApiKey")}
                    </a>
                  </div>
                )}
                {active && (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                    {method === "api_key" ? (
                      <select
                        aria-label={t("auth.modelLabel")}
                        value={model}
                        onChange={(event) => setModel(event.target.value)}
                        className="h-8 rounded-lg border border-slate-700 bg-slate-950 px-2 text-xs text-white"
                      >
                        {item.models.map((choice) => (
                          <option key={choice.id} value={choice.id}>
                            {t(choice.labelKey)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-[11px] text-slate-400">
                        {t("auth.localModelNote")}
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={status === "testing" || saving === item.id}
                      onClick={() => void testConnection(item.id)}
                      className="flex h-8 items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {status === "testing" || saving === item.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      {t("auth.testConnection")}
                    </button>
                    <span
                      className={`text-[11px] ${status === "connected" ? "text-emerald-400" : status === "error" ? "text-rose-400" : "text-slate-400"}`}
                    >
                      {messages[item.id]}
                    </span>
                  </div>
                )}
              </section>
            );
          })}
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] leading-4 text-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {t("auth.localCliWarning")}
          </div>
        </div>
      </div>
    </div>
  );
};
