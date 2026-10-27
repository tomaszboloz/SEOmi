import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface SecretKeyFieldProps {
  id?: string;
  /** Accessible name; the visible label, when there is one, points at `id`. */
  label: string;
  /** A credential is already stored. Its value never reaches the WebView. */
  stored: boolean;
  disabled?: boolean;
  /** Shown while nothing is stored; defaults to the generic paste hint. */
  placeholder?: string;
  inputClassName: string;
  onSave: (value: string) => Promise<unknown> | void;
}

type Outcome = 'idle' | 'saved' | 'removed' | 'failed';

const OUTCOME_KEYS: Record<Exclude<Outcome, 'idle'>, string> = {
  saved: 'runtimeErrors.ai.credentialSaved',
  removed: 'auth.apiKeyRemoved',
  failed: 'auth.apiKeySaveFailed',
};

const BUTTON = 'h-9 shrink-0 rounded-lg border px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40';

/**
 * Entry for a credential the WebView may write but never read back. The typed
 * value stays a local draft until it is saved: the store keeps only a presence
 * marker, so saving on every change emptied the field after each character and
 * stored the last character alone.
 */
export const SecretKeyField: React.FC<SecretKeyFieldProps> = ({ id, label, stored, disabled = false, placeholder, inputClassName, onSave }) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [outcome, setOutcome] = useState<Outcome>('idle');
  const [busy, setBusy] = useState(false);
  const value = draft.trim();
  const canSave = Boolean(value) && !busy && !disabled;

  const commit = async (next: string) => {
    setBusy(true);
    try {
      await onSave(next);
      setDraft('');
      setOutcome(next ? 'saved' : 'removed');
    } catch {
      setOutcome('failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex min-w-0 gap-2">
        <input
          id={id}
          aria-label={label}
          type="password"
          autoComplete="new-password"
          value={draft}
          disabled={disabled}
          onChange={(event) => { setDraft(event.target.value); setOutcome('idle'); }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || !canSave) return;
            event.preventDefault();
            void commit(value);
          }}
          placeholder={stored ? t('auth.apiKeyStoredPlaceholder') : placeholder ?? t('auth.apiKeyPlaceholder')}
          className={inputClassName}
        />
        <button type="button" disabled={!canSave} onClick={() => void commit(value)} className={`${BUTTON} border-emerald-500/40 bg-emerald-500/10 text-emerald-200`}>
          {t('auth.saveApiKey')}
        </button>
        {stored && !draft && (
          <button type="button" disabled={busy || disabled} onClick={() => void commit('')} className={`${BUTTON} border-slate-700 bg-slate-800 text-slate-300`}>
            {t('auth.removeApiKey')}
          </button>
        )}
      </div>
      {outcome !== 'idle' && (
        <p role={outcome === 'failed' ? 'alert' : 'status'} className={`text-[11px] leading-4 ${outcome === 'failed' ? 'text-rose-300' : 'text-emerald-300'}`}>
          {t(OUTCOME_KEYS[outcome])}
        </p>
      )}
    </div>
  );
};
