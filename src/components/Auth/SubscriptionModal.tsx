import React from 'react';
import { AlertCircle } from 'lucide-react';
import { useSubscriptionModalSession } from './subscriptionModal/useSubscriptionModalSession';
import { PROVIDERS_CONFIG } from './subscriptionModal/subscriptionModalTypes';
import { SubscriptionModalHeader } from './subscriptionModal/SubscriptionModalHeader';
import { SubscriptionProviderCard } from './subscriptionModal/SubscriptionProviderCard';

export const SubscriptionModal: React.FC = () => {
  const {
    t,
    closeModal,
    provider,
    apiKeys,
    methods,
    statuses,
    messages,
    cliStatus,
    setProvider,
    setMethod,
    testConnection,
    saving,
    dialogRef,
    saveKey,
  } = useSubscriptionModalSession();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-connections-title"
        tabIndex={-1}
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl outline-none"
      >
        <SubscriptionModalHeader onClose={closeModal} t={t} />

        <div className="space-y-4 overflow-y-auto p-6">
          {PROVIDERS_CONFIG.map((item) => (
            <SubscriptionProviderCard
              key={item.id}
              item={item}
              active={provider === item.id}
              method={methods[item.id]}
              cli={cliStatus[item.id]}
              status={statuses[item.id]}
              statusMessage={messages[item.id]}
              apiKey={apiKeys[item.id]}
              saving={saving === item.id}
              onSetProvider={setProvider}
              onSetMethod={setMethod}
              onSaveKey={saveKey}
              onTestConnection={testConnection}
              t={t}
            />
          ))}

          <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] leading-4 text-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {t('auth.localCliWarning')}
          </div>
        </div>
      </div>
    </div>
  );
};
