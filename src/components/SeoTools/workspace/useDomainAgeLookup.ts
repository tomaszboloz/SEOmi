import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectStore } from '@/stores/projectStore';
import { readStorage, writeStorage } from '@/services/storage';
import {
  type RdapDomain,
  domainAgeInputStorageKey,
  domainFromInput,
} from './seoToolsTypes';

export const useDomainAgeLookup = () => {
  const { t, i18n } = useTranslation();
  const projectId = useProjectStore((state) => state.activeProjectId);
  const project = useProjectStore((state) =>
    state.projects.find((item) => item.id === state.activeProjectId),
  );
  const [domain, setDomain] = useState(project?.rootUrl || '');
  const [record, setRecord] = useState<RdapDomain | null>(null);
  const [registrationDate, setRegistrationDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const requestToken = useRef(0);
  const requestController = useRef<AbortController | null>(null);

  useEffect(() => {
    requestToken.current += 1;
    requestController.current?.abort();
    requestController.current = null;
    setDomain(
      projectId
        ? (readStorage(domainAgeInputStorageKey(projectId)) ??
            project?.rootUrl) || ''
        : '',
    );
    setRecord(null);
    setRegistrationDate(null);
    setError(null);
    setLoading(false);
    return () => {
      requestToken.current += 1;
      requestController.current?.abort();
      requestController.current = null;
    };
  }, [projectId, project?.rootUrl]);

  const updateDomain = (next: string) => {
    setDomain(next);
    if (projectId) writeStorage(domainAgeInputStorageKey(projectId), next);
  };

  const check = async () => {
    let hostname: string;
    try {
      hostname = domainFromInput(domain);
    } catch {
      setError(t('seoTools.invalidDomain'));
      return;
    }
    const token = ++requestToken.current;
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setLoading(true);
    setRecord(null);
    setRegistrationDate(null);
    setError(null);
    try {
      const timeout = globalThis.setTimeout(() => controller.abort(), 10_000);
      let response: Response;
      try {
        response = await fetch(
          `https://rdap.org/domain/${encodeURIComponent(hostname)}`,
          {
            headers: { Accept: 'application/rdap+json, application/json' },
            signal: controller.signal,
          },
        );
      } finally {
        globalThis.clearTimeout(timeout);
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as RdapDomain;
      const registration = (payload.events || []).find(
        (event) => event.eventAction.toLowerCase() === 'registration',
      );
      if (requestToken.current !== token) return;
      setRecord(payload);
      setRegistrationDate(registration?.eventDate || null);
      if (!registration) setError(t('seoTools.rdapUnavailable'));
    } catch (cause) {
      if (requestToken.current !== token) return;
      setError(
        cause instanceof Error && cause.message.startsWith('HTTP')
          ? t('seoTools.lookupFailed', { error: cause.message })
          : t('seoTools.lookupFailed', { error: t('seoTools.rdapUnavailable') }),
      );
    } finally {
      if (requestToken.current === token) {
        requestController.current = null;
        setLoading(false);
      }
    }
  };

  return {
    t,
    i18n,
    domain,
    updateDomain,
    record,
    registrationDate,
    error,
    loading,
    check,
  };
};
