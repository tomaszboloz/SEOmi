import React from "react";
import { useTranslation } from "react-i18next";
import type { PageAuditData } from "@/types";

interface OverviewContentAnalysisProps {
  audit: PageAuditData;
}

export const OverviewContentAnalysis: React.FC<OverviewContentAnalysisProps> = ({
  audit,
}) => {
  const { t } = useTranslation();

  const complexityLabels: Record<
    NonNullable<typeof audit.content_stats.complexity_label>,
    string
  > = {
    simple: t("overview.complexitySimple"),
    moderate: t("overview.complexityModerate"),
    complex: t("overview.complexityComplex"),
    unavailable: t("overview.complexityUnavailable"),
  };
  const complexityLabel = audit.content_stats.complexity_label || "unavailable";

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
      <header className="flex flex-col gap-1 border-b border-slate-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">
            {t("legacyUi.overview.contentAnalysisTitle")}
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            {t("legacyUi.overview.contentAnalysisDescription")}
          </p>
        </div>
        <span
          className={`w-fit rounded-full border px-2 py-1 text-[11px] font-semibold ${
            complexityLabel === "complex"
              ? "border-rose-500/25 bg-rose-500/10 text-rose-300"
              : complexityLabel === "moderate"
                ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
                : "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
          }`}
        >
          {complexityLabels[complexityLabel]}
        </span>
      </header>
      {audit.content_stats.word_count === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-400">
          {t("legacyUi.overview.noVisibleText")}
        </p>
      ) : (
        <div className="grid gap-px bg-slate-800 lg:grid-cols-[.8fr_1.2fr]">
          <div className="grid grid-cols-2 gap-px bg-slate-800 sm:grid-cols-5 lg:grid-cols-2">
            <div className="bg-slate-900/60 p-4">
              <p className="text-[11px] text-slate-500">
                {t("legacyUi.overview.sentences")}
              </p>
              <p className="mt-1 font-mono text-lg font-semibold text-slate-100">
                {audit.content_stats.sentence_count ?? "—"}
              </p>
            </div>
            <div className="bg-slate-900/60 p-4">
              <p className="text-[11px] text-slate-500">
                {t("legacyUi.overview.wordsPerSentence")}
              </p>
              <p className="mt-1 font-mono text-lg font-semibold text-slate-100">
                {audit.content_stats.average_words_per_sentence?.toFixed(1) ??
                  "—"}
              </p>
            </div>
            <div className="bg-slate-900/60 p-4">
              <p className="text-[11px] text-slate-500">
                {t("legacyUi.overview.charactersPerWord")}
              </p>
              <p className="mt-1 font-mono text-lg font-semibold text-slate-100">
                {audit.content_stats.average_characters_per_word?.toFixed(1) ??
                  "—"}
              </p>
            </div>
            <div className="bg-slate-900/60 p-4">
              <p className="text-[11px] text-slate-500">
                {t("legacyUi.overview.complexityIndex")}
              </p>
              <p className="mt-1 font-mono text-lg font-semibold text-slate-100">
                {audit.content_stats.complexity_score ?? "—"}
                <span className="ml-1 text-xs text-slate-500">/100</span>
              </p>
            </div>
            <div className="bg-slate-900/60 p-4">
              <p className="text-[11px] text-slate-500">
                {t("legacyUi.overview.readability")}
              </p>
              <p className="mt-1 font-mono text-lg font-semibold text-slate-100">
                {audit.content_stats.readability_ease_score
                  ? audit.content_stats.readability_ease_score.toFixed(0)
                  : "—"}
                <span className="ml-1 text-xs text-slate-500">/100</span>
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                {t("legacyUi.overview.grade")}{" "}
                {audit.content_stats.readability_grade?.toFixed(1) ?? "—"} ·{" "}
                {audit.content_stats.readability_label ||
                  t("legacyUi.overview.noData")}
                {audit.content_stats.readability_method ? (
                  <>
                    {" · "}
                    {t("legacyUi.overview.formula")}:{" "}
                    {audit.content_stats.readability_method}
                  </>
                ) : null}
              </p>
            </div>
          </div>
          <div className="bg-slate-900/60 p-4">
            <p className="text-[11px] font-medium text-slate-400">
              {t("legacyUi.overview.topTerms")}
            </p>
            {audit.content_stats.top_keywords.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {audit.content_stats.top_keywords.map((term) => (
                  <span
                    key={term.keyword}
                    className="rounded-md border border-slate-700 bg-slate-950/70 px-2.5 py-1 text-xs text-slate-200"
                  >
                    <span className="font-medium">{term.keyword}</span>
                    <span className="ml-1.5 font-mono text-slate-500">
                      {term.count}
                      {term.density_percent !== undefined
                        ? ` · ${term.density_percent.toFixed(2)}%`
                        : ""}
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500">
                {t("legacyUi.overview.noTerms")}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
