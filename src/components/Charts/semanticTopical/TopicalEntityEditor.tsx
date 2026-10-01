

import { inputClass, labelClass } from './workspaceHelpers';

import type { useSemanticTopicalSession } from './useSemanticTopicalSession';

type Session = ReturnType<typeof useSemanticTopicalSession>;
export const TopicalEntityEditor = ({ session }: { session: Session }) => {
const { addEntityFact, document, documentRef, factDraft, setFactDraft, t, updateEntity } = session;

return (<section className="rounded-xl border border-slate-800 bg-slate-900/45 p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-100">
                  {t("semanticWorkspace.entityTitle")}
                </h4>
                <p className="mt-1 text-[11px] text-slate-500">
                  {t("semanticWorkspace.entityDescription")}
                </p>
              </div>
              <span className="rounded border border-slate-700 px-2 py-1 font-mono text-[10px] text-slate-500">
                {t("semanticWorkspace.eavCount", {
                  count: document.entity.facts.length,
                })}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className={labelClass}>
                {t("semanticWorkspace.entityLabel")}
                <input
                  className={inputClass}
                  value={document.entity.name}
                  maxLength={180}
                  onChange={(event) =>
                    updateEntity({ name: event.target.value })
                  }
                  placeholder={t("semanticWorkspace.entityPlaceholder")}
                />
              </label>
              <label className={labelClass}>
                {t("semanticWorkspace.contextLabel")}
                <textarea
                  className="mt-1 min-h-20 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-slate-100 outline-none focus:border-emerald-400"
                  value={document.entity.description}
                  maxLength={5000}
                  onChange={(event) =>
                    updateEntity({ description: event.target.value })
                  }
                  placeholder={t("semanticWorkspace.contextPlaceholder")}
                />
              </label>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[.8fr_1fr_1.4fr_auto] sm:items-end">
              <label className={labelClass}>
                {t("semanticWorkspace.factAttribute")}
                <input
                  className={inputClass}
                  value={factDraft.attribute}
                  maxLength={120}
                  onChange={(event) =>
                    setFactDraft((current) => ({
                      ...current,
                      attribute: event.target.value,
                    }))
                  }
                  placeholder={t("semanticWorkspace.factAttributePlaceholder")}
                />
              </label>
              <label className={labelClass}>
                {t("semanticWorkspace.factValue")}
                <input
                  className={inputClass}
                  value={factDraft.value}
                  maxLength={1000}
                  onChange={(event) =>
                    setFactDraft((current) => ({
                      ...current,
                      value: event.target.value,
                    }))
                  }
                  placeholder={t("semanticWorkspace.factValuePlaceholder")}
                />
              </label>
              <label className={labelClass}>
                {t("semanticWorkspace.sourceOptional")}
                <input
                  className={inputClass}
                  value={factDraft.sourceUrl}
                  onChange={(event) =>
                    setFactDraft((current) => ({
                      ...current,
                      sourceUrl: event.target.value,
                    }))
                  }
                  placeholder={t("semanticWorkspace.sourceUrlPlaceholder")}
                />
              </label>
              <button
                type="button"
                onClick={addEntityFact}
                disabled={
                  !factDraft.attribute.trim() || !factDraft.value.trim()
                }
                className="h-9 rounded-md border border-slate-700 px-3 text-xs text-slate-200 hover:border-emerald-400 disabled:opacity-40"
              >
                {t("semanticWorkspace.addFact")}
              </button>
            </div>
            {document.entity.facts.length > 0 && (
              <ul className="mt-3 divide-y divide-slate-800 rounded-lg border border-slate-800">
                {document.entity.facts.map((fact) => (
                  <li
                    key={fact.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
                  >
                    <span className="min-w-0">
                      <strong className="text-slate-300">
                        {fact.attribute}:
                      </strong>{" "}
                      <span className="text-slate-400">{fact.value}</span>
                      {fact.sourceUrl && (
                        <a
                          href={fact.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-2 break-all text-[10px] text-sky-300"
                        >
                          {t("semanticWorkspace.source")}
                        </a>
                      )}
                      <span
                        className={`ml-2 text-[9px] ${fact.reuseStatus === "verified" ? "text-emerald-300" : "text-amber-300"}`}
                      >
                        {fact.reuseStatus === "verified"
                          ? t("semanticWorkspace.verified")
                          : t("semanticWorkspace.locked")}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <label className="flex items-center gap-1 text-[9px] text-slate-500">
                        <input
                          type="checkbox"
                          aria-label={t("semanticWorkspace.confirmFact", {
                            attribute: fact.attribute,
                          })}
                          checked={fact.reuseStatus === "verified"}
                          disabled={!fact.sourceUrl}
                          onChange={(event) =>
                            updateEntity({
                              facts: documentRef.current.entity.facts.map(
                                (item) =>
                                  item.id === fact.id
                                    ? {
                                        ...item,
                                        reuseStatus: event.target.checked
                                          ? "verified"
                                          : "locked",
                                      }
                                    : item,
                              ),
                            })
                          }
                        />
                        {t("semanticWorkspace.confirmedByMe")}
                      </label>
                      <button
                        type="button"
                        aria-label={t("semanticWorkspace.removeFact", {
                          attribute: fact.attribute,
                        })}
                        onClick={() =>
                          updateEntity({
                            facts: documentRef.current.entity.facts.filter(
                              (item) => item.id !== fact.id,
                            ),
                          })
                        }
                        className="text-slate-500 hover:text-rose-300"
                      >
                        {t("semanticWorkspace.removeFact", {
                          attribute: fact.attribute,
                        })}
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>);
};
