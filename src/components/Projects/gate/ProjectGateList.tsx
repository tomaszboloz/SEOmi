import { useTranslation } from 'react-i18next';
import { ArrowRight, Globe2, Layers3 } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';

export const ProjectGateList = () => {
  const { t } = useTranslation();
  const projects = useProjectStore(s => s.projects);
  const selectProject = useProjectStore(s => s.selectProject);
  return (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-7 shadow-2xl shadow-black/20 sm:p-9">
          <div className="mb-8 flex items-center gap-3">
            <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-3 text-emerald-300">
              <Layers3 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                {t("projects.workspaceLabel")}
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
                {t("projects.chooseProject")}
              </h1>
            </div>
          </div>

          {projects.length ? (
            <div className="space-y-2">
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => selectProject(project.id)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-left transition hover:border-emerald-400/45 hover:bg-slate-800/70"
                >
                  <Globe2 className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-emerald-300" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-100">
                      {project.name}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {project.rootUrl || t("projects.noStartingDomain")}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-emerald-300" />
                </button>
              ))}
            </div>
          ) : (
            <p className="max-w-md text-sm leading-6 text-slate-400">
              {t("projects.emptyDescription")}
            </p>
          )}
        </div>

  );
};
