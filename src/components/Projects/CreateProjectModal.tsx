import { FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FolderPlus } from "lucide-react";
import { useProjectStore } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";
import {
  validateProjectName,
  validateProjectRootUrl,
} from "@/services/projectValidation";
import { useModalA11y } from "@/hooks/useModalA11y";
import { CreateProjectModalHeader } from "./createProject/CreateProjectModalHeader";
import { ProjectNameInputField } from "./createProject/ProjectNameInputField";
import { ProjectRootUrlInputField } from "./createProject/ProjectRootUrlInputField";

export const CreateProjectModal = () => {
  const { t } = useTranslation();
  const createProject = useProjectStore((state) => state.createProject);
  const closeModal = useUIStore((state) => state.closeModal);
  const nameInput = useRef<HTMLInputElement>(null);
  const dialogRef = useModalA11y<HTMLElement>(closeModal);
  const [name, setName] = useState("");
  const [rootUrl, setRootUrl] = useState("");
  const [validationError, setValidationError] = useState("");
  const [validationField, setValidationField] = useState<"name" | "rootUrl" | null>(null);

  useEffect(() => {
    nameInput.current?.focus();
  }, []);

  const handleNameChange = (value: string) => {
    setName(value);
    if (value.trim()) {
      setValidationError("");
      setValidationField(null);
    }
  };

  const handleRootUrlChange = (value: string) => {
    setRootUrl(value);
    if (validationField === "rootUrl") {
      setValidationError("");
      setValidationField(null);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nameValidation = validateProjectName(name);
    if (!nameValidation.ok) {
      setValidationError(nameValidation.message);
      setValidationField("name");
      nameInput.current?.focus();
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
      closeModal();
    } catch (error) {
      setValidationError(
        error instanceof Error ? error.message : t("projects.createError"),
      );
      setValidationField("rootUrl");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal();
      }}
    >
      <section
        ref={dialogRef}
        aria-labelledby="create-project-title"
        aria-describedby="create-project-description"
        aria-modal="true"
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        role="dialog"
      >
        <CreateProjectModalHeader onClose={closeModal} />

        <form onSubmit={submit} className="space-y-4 p-5">
          <ProjectNameInputField
            name={name}
            onChange={handleNameChange}
            nameInputRef={nameInput}
            validationError={validationError}
            isInvalid={validationField === "name"}
          />
          <ProjectRootUrlInputField
            rootUrl={rootUrl}
            onChange={handleRootUrlChange}
            validationError={validationError}
            isInvalid={validationField === "rootUrl"}
          />
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeModal}
              className="h-10 rounded-lg border border-slate-700 px-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              {t("projects.cancel")}
            </button>
            <button
              type="submit"
              className="flex h-10 items-center gap-2 rounded-lg bg-emerald-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
            >
              {t("projects.createAndOpen")}
              <FolderPlus className="h-4 w-4" />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};
