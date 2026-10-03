import type { Session as EditorSession } from './editor/types';
import { EntityIdentityFields } from './editor/EntityIdentityFields';
import { EntityFactForm } from './editor/EntityFactForm';
import { EntityFactList } from './editor/EntityFactList';

export const TopicalEntityEditor = ({ session }: { session: EditorSession }) => {
const { document, t } = session;

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
            <EntityIdentityFields session={session} />
            <EntityFactForm session={session} />
            <EntityFactList session={session} />
          </section>);
};
