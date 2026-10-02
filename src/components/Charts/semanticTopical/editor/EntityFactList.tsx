import type { Session } from './types';

export const EntityFactList = ({ session }: { session: Session }) => {
  const { document, documentRef, t, updateEntity } = session;
  return (<>{document.entity.facts.length > 0 && (
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
            )}</>);
};
