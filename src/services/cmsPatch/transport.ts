import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri';
import { assertSafeCmsUrl } from './ssrf';
import type { CmsResponse, CmsTransport } from './types';

export const cmsTransport: CmsTransport = async (request) => {
  assertSafeCmsUrl(request.url);
  if (!isTauriEnvironment()) throw new Error('cmsPanelUi.desktopOnly');
  return invokeTauriCommand<CmsResponse>('cms_patch_request', { request });
};
