import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import './i18n';
import i18n, { languageReady } from './i18n';
import { RootErrorBoundary } from './components/Layout/RootErrorBoundary';
import { installChunkLoadRecovery } from './services/lazyRoute';

installChunkLoadRecovery();

const mount = () => {
  const rootErrorProps = {
    title: i18n.t('mainContent.routeErrorTitle'),
    description: i18n.t('mainContent.routeErrorDescription'),
    retryLabel: i18n.t('mainContent.retryRoute'),
    reloadLabel: i18n.t('mainContent.reloadApp'),
  };
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <RootErrorBoundary {...rootErrorProps}>
        <App />
      </RootErrorBoundary>
    </React.StrictMode>,
  );
};

void languageReady.then(mount, mount);
