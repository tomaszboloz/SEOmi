import { useTranslation } from "react-i18next";
import type { TopicalEntityFact } from "@/services/topicalMap";
export const Metric = ({ label, value }: { label: string; value: number }) => (
  <div className="min-w-20 rounded-md border border-slate-700/70 bg-slate-950/40 px-3 py-2">
    <div className="text-base font-semibold tabular-nums text-slate-100">
      {value}
    </div>
    <div className="mt-0.5 text-[9px] uppercase tracking-wide text-slate-500">
      {label}
    </div>
  </div>
);

export const FactReuseToggle = ({
  fact,
  onChange,
}: {
  fact: TopicalEntityFact;
  onChange: (status: TopicalEntityFact["reuseStatus"]) => void;
}) => {
  const { t } = useTranslation();
  return (
    <label
      className={`ml-2 inline-flex items-center gap-1 text-[9px] ${fact.reuseStatus === "verified" ? "text-emerald-300" : "text-amber-300"}`}
    >
      <input
        type="checkbox"
        aria-label={t("semanticWorkspace.confirmFact", {
          attribute: fact.attribute,
        })}
        checked={fact.reuseStatus === "verified"}
        disabled={!fact.sourceUrl}
        onChange={(event) =>
          onChange(event.target.checked ? "verified" : "locked")
        }
      />
      {fact.reuseStatus === "verified"
        ? t("semanticWorkspace.verified")
        : t("semanticWorkspace.locked")}
    </label>
  );
};