import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { useProjectStore } from "@/stores/projectStore";
import {
  validateProjectName,
  validateProjectRootUrl,
} from "@/services/projectValidation";

export type ProjectDraftField = "name" | "rootUrl";

interface ProjectDraftOptions {
  onCreated?: () => void;
  onInvalidName?: () => void;
}

/** Shared create-project form state: validation, error ownership and creation. */
export const useProjectDraft = ({ onCreated, onInvalidName }: ProjectDraftOptions = {}) => {
  const { t } = useTranslation();
  const createProject = useProjectStore((state) => state.createProject);
  const [name, setNameValue] = useState("");
  const [rootUrl, setRootUrlValue] = useState("");
  const [validationError, setValidationError] = useState("");
  const [validationField, setValidationField] = useState<ProjectDraftField | null>(null);

  const fail = (message: string, field: ProjectDraftField) => {
    setValidationError(message);
    setValidationField(field);
  };
  const clearError = () => {
    setValidationError("");
    setValidationField(null);
  };

  const setName = (value: string) => {
    setNameValue(value);
    if (value.trim()) clearError();
  };
  const setRootUrl = (value: string) => {
    setRootUrlValue(value);
    if (validationField === "rootUrl") clearError();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nameValidation = validateProjectName(name);
    if (!nameValidation.ok) {
      fail(nameValidation.message, "name");
      onInvalidName?.();
      return;
    }
    const rootValidation = validateProjectRootUrl(rootUrl);
    if (!rootValidation.ok) {
      fail(rootValidation.message, "rootUrl");
      return;
    }
    try {
      createProject({ name, rootUrl: rootValidation.value });
      onCreated?.();
    } catch (error) {
      fail(error instanceof Error ? error.message : t("projects.createError"), "rootUrl");
    }
  };

  const errorFor = (field: ProjectDraftField) =>
    validationError && validationField === field ? validationError : "";

  return { name, rootUrl, setName, setRootUrl, submit, validationField, errorFor };
};
