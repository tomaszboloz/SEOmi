import { inputClass, labelClass } from '../workspaceHelpers';
import type { Session } from './types';

export const EntityFactForm = ({ session }: { session: Session }) => {
  const { addEntityFact, factDraft, setFactDraft, t } = session;
  return (<div className="mt-3 grid gap-2 sm:grid-cols-[.8fr_1fr_1.4fr_auto] sm:items-end">
              <label className={labelClass}>
                {t("semanticWorkspace.factAttribute")}
                <input
                  className={inputClass}
                  value={factDraft.attribute}
                  maxLength={120}
                  onChange={(event) => {
                          const value = event.currentTarget.value;
                          setFactDraft((current) => ({ ...current, attribute: value }));
                        }}
                  placeholder={t("semanticWorkspace.factAttributePlaceholder")}
                />
              </label>
              <label className={labelClass}>
                {t("semanticWorkspace.factValue")}
                <input
                  className={inputClass}
                  value={factDraft.value}
                  maxLength={1000}
                  onChange={(event) => {
                          const value = event.currentTarget.value;
                          setFactDraft((current) => ({ ...current, value: value }));
                        }}
                  placeholder={t("semanticWorkspace.factValuePlaceholder")}
                />
              </label>
              <label className={labelClass}>
                {t("semanticWorkspace.sourceOptional")}
                <input
                  className={inputClass}
                  value={factDraft.sourceUrl}
                  onChange={(event) => {
                          const value = event.currentTarget.value;
                          setFactDraft((current) => ({ ...current, sourceUrl: value }));
                        }}
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
            </div>);
};
