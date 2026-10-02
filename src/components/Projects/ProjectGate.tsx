import { ProjectGateList } from './gate/ProjectGateList';
import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, FolderPlus } from "lucide-react";
import { useProjectStore } from "@/stores/projectStore";
import {
  validateProjectName,
  validateProjectRootUrl,
} from "@/services/projectValidation";

export const ProjectGate = () => {
  const { t } = useTranslation();
  const createProject = useProjectStore((state) => state.createProject);
  const [name, setName] = useState("");
  const [rootUrl, setRootUrl] = useState("");
  const [validationError, setValidationError] = useState("");
  const [validationField, setValidationField] = useState<
    "name" | "rootUrl" | null
  >(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nameValidation = validateProjectName(name);
    if (!nameValidation.ok) {
      setValidationError(nameValidation.message);
      setValidationField("name");
      return;
    }

    const rootValidation = validateProjectRootUrl(rootUrl);
    if (!rootValidation.ok) {
      setValidationError(rootValidation.message);
      setValidationField("rootUrl");
      return;
    }

    try {
      createProject({ name, rootUrl: rootValidation.value });
    } catch (error) {
      setValidationError(
        error instanceof Error ? error.message : t("projects.createError"),
      );
      setValidationField("rootUrl");
    }
  };

  return (
    <main className="min-h-screen overflow-y-auto bg-[var(--color-bg-primary)] px-5 py-10 text-slate-100 sm:px-10">
      <section className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[1.1fr_.9fr]">
        <ProjectGateList />

        <form
          onSubmit={submit}
          className="rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-emerald-400/10 to-slate-900 p-7 sm:p-9"
        >
          <div className="mb-7 flex items-center gap-3">
            <FolderPlus className="h-5 w-5 text-emerald-300" />
            <h2 className="text-lg font-semibold text-white">
              {t("projects.newProject")}
            </h2>
          </div>
          <label className="mb-4 block text-xs font-medium text-slate-300">
            {t("projects.name")}
            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (event.target.value.trim()) {
                  setValidationError("");
                  setValidationField(null);
                }
              }}
              aria-invalid={validationField === "name"}
              aria-describedby={
                validationField === "name"
                  ? "project-gate-name-error"
                  : undefined
              }
              required
              maxLength={80}
              placeholder={t("projects.namePlaceholder")}
              className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-400"
            />
            {validationError && validationField === "name" && (
              <span
                id="project-gate-name-error"
                role="alert"
                className="mt-2 block text-xs text-rose-300"
              >
                {validationError}
              </span>
            )}
          </label>
          <label className="block text-xs font-medium text-slate-300">
            {t("projects.startingDomain")}{" "}
            <span className="font-normal text-slate-500">
              ({t("projects.optional")})
            </span>
            <input
              value={rootUrl}
              onChange={(event) => {
                setRootUrl(event.target.value);
                if (validationField === "rootUrl") {
                  setValidationError("");
                  setValidationField(null);
                }
              }}
              aria-invalid={validationField === "rootUrl"}
              aria-describedby={
                validationField === "rootUrl"
                  ? "project-gate-root-url-error"
                  : undefined
              }
              maxLength={2048}
              placeholder={t("projects.startingDomainPlaceholder")}
              className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-400"
            />
            {validationError && validationField === "rootUrl" && (
              <span
                id="project-gate-root-url-error"
                role="alert"
                className="mt-2 block text-xs text-rose-300"
              >
                {validationError}
              </span>
            )}
          </label>
          <button
            type="submit"
            className="mt-7 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
          >
            {t("projects.createAndOpenProject")}{" "}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </section>
    </main>
  );
};
