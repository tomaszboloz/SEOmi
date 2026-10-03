import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import type { AiProvider } from '@/types';

export const useSubscriptionModalSession = () => {
  const { t } = useTranslation();
  const closeModal = useUIStore((s) => s.closeModal);
  const provider = useAuthStore((s) => s.provider);
  const model = useAuthStore((s) => s.model);
  const apiKeys = useAuthStore((s) => s.apiKeys);
  const methods = useAuthStore((s) => s.connectionMethod);
  const statuses = useAuthStore((s) => s.connectionStatus);
  const messages = useAuthStore((s) => s.statusMessages);
  const cliStatus = useAuthStore((s) => s.cliStatus);
  const setProvider = useAuthStore((s) => s.setProvider);
  const setModel = useAuthStore((s) => s.setModel);
  const setMethod = useAuthStore((s) => s.setConnectionMethod);
  const setApiKey = useAuthStore((s) => s.setApiKey);
  const testConnection = useAuthStore((s) => s.testProviderConnection);
  const detectLocalClients = useAuthStore((s) => s.detectLocalClients);
  const [saving, setSaving] = useState<AiProvider | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button, input, select, a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute('disabled'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [closeModal]);

  useEffect(() => {
    void detectLocalClients();
  }, [detectLocalClients]);

  const saveKey = async (id: AiProvider, value: string) => {
    setSaving(id);
    try {
      await setApiKey(id, value);
    } catch {
      // The store records the translated keychain error in the provider row.
    } finally {
      setSaving(null);
    }
  };

  return {
    t,
    closeModal,
    provider,
    model,
    apiKeys,
    methods,
    statuses,
    messages,
    cliStatus,
    setProvider,
    setModel,
    setMethod,
    testConnection,
    saving,
    dialogRef,
    saveKey,
  };
};
