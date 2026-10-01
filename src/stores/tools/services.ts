import { getSecureValue, invokeTauriCommand } from '@/services/tauri';
import { loadCrawlRuns, saveCrawlRuns } from '@/services/crawlPersistence';
import { notifyCrawlCompleted } from '@/services/desktopNotifications';
import type { ToolsServices } from './contracts';
import { DataForSEOClient } from '@/services/dataforseo';
import { useAuthStore } from '../authStore';
export const toolsServices: ToolsServices = {
invoke: (...args) => invokeTauriCommand(...args),
secureValue: (...args) => getSecureValue(...args),
loadCrawlRuns: (...args) => loadCrawlRuns(...args),
saveCrawlRuns: (...args) => saveCrawlRuns(...args),
notifyCrawlCompleted: (...args) => notifyCrawlCompleted(...args),
createDataForSeoClient: (login, password) => new DataForSEOClient(login, password),
generateText: (...args) => useAuthStore.getState().generateTextForProvider(...args),
};
