import type { CrawlConfig, CrawlEnvironment } from '@/types';
import type { getSecureValue, invokeTauriCommand } from '@/services/tauri';
import type { loadCrawlRuns, saveCrawlRuns } from '@/services/crawlPersistence';
import type { notifyCrawlCompleted } from '@/services/desktopNotifications';
import type { DataForSEOClient } from '@/services/dataforseo';
import type { useAuthStore } from '../authStore';
import type { StoreApi } from 'zustand';
import type { ToolsData } from './contracts/state';
import type { ToolsActions } from './contracts/actions';

export interface ToolsState extends ToolsData, ToolsActions {}

export interface RankTrackingDraft {
  keyword: string;
  domain: string;
  targetUrl: string;
  location: string;
  language: string;
}

export interface CrawlProjectSettings {
  url: string;
  limit: number;
  config: CrawlConfig;
}

export interface InterruptedCrawl {
  url: string;
  limit: number;
  config: CrawlConfig;
  environment: CrawlEnvironment;
  startedAt: string;
  /** Monotonic freshness marker used to reconcile WebView and native copies. */
  updatedAt: string;
  completedUrls?: string[];
  frontierUrls?: string[];
  baseRunId?: string;
}

export type ToolsSet = StoreApi<ToolsState>['setState'];

export type ToolsGet = StoreApi<ToolsState>['getState'];

export interface ToolsServices {
invoke: typeof invokeTauriCommand;
secureValue: typeof getSecureValue;
loadCrawlRuns: typeof loadCrawlRuns;
saveCrawlRuns: typeof saveCrawlRuns;
notifyCrawlCompleted: typeof notifyCrawlCompleted;
createDataForSeoClient: (login: string, password: string) => DataForSEOClient;
generateText: ReturnType<typeof useAuthStore.getState>['generateTextForProvider'];
}
