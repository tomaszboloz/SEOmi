import type { AppConfig } from '@/types';
import { readStorage } from '@/services/storage';
import i18n from '@/i18n';
import { useProjectStore } from '../projectStore';
export const DEFAULT_CONFIG: AppConfig = {
  theme: 'dark',
  language: readStorage('seomi_language') || 'en',
  default_user_agent: 'chrome_mac',
  request_timeout_secs: 15,
  max_redirects: 10,
  verify_ssl: true,
  ai_provider: 'openai',
  ai_model: 'gpt-4o',
  auto_check_updates: true,
  auto_install_updates: false,
};

export const activeProjectId = (): string => readStorage('seomi_active_project_v1') || useProjectStore.getState().activeProjectId || '';
export const dataForSeoSecretNameFor = (kind: 'login' | 'password', projectId: string): string => {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(projectId)) throw new Error(i18n.t('runtimeErrors.settings.projectDataforseo'));
  return `dataforseo_${kind}_${projectId}`;
};
export const googleMetricsSecretNameFor = (projectId: string): string => {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(projectId)) throw new Error(i18n.t('runtimeErrors.settings.projectGoogle'));
  return `google_metrics_api_key_${projectId}`;
};

