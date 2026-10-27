import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectStore } from '@/stores/projectStore';
import { readStorage, writeStorage } from '@/services/storage';
import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri';
import {
  type RdapDomain,
  domainAgeInputStorageKey,
  domainFromInput,
} from './seoToolsTypes';

const RDAP_TIMEOUT_MS = 10_000;

/** Desktop builds query RDAP natively so the WebView CSP needs no remote connect-src. */
const lookupRdap = async (hostname: string, controller: AbortController): Promise<RdapDomain> => {
  const timeout = globalThis.setTimeout(() => controller.abort(), RDAP_TIMEOUT_MS);
  try {
    if (isTauriEnvironment()) {
      const aborted = new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });
      return await Promise.race([invokeTauriCommand<RdapDomain>('rdap_domain_lookup', { domain: hostname }), aborted]);
    }
    const response = await fetch(`https://rdap.org/domain/${encodeURIComponent(hostname)}`, {
      headers: { Accept: 'application/rdap+json, application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as RdapDomain;
  } finally {
    globalThis.clearTimeout(timeout);
  }
};

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
      const payload = await lookupRdap(hostname, controller);
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
