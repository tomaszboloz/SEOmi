import { inputClass, labelClass } from '../workspaceHelpers';
import type { Session } from './types';

export const EntityIdentityFields = ({ session }: { session: Session }) => {
  const { document, t, updateEntity } = session;
  return (<div className="grid gap-3 md:grid-cols-2">
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
            </div>);
};
