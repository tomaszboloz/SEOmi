import { invokeTauriCommand } from '@/services/tauri';
import type { Ga4DateRange, Ga4Discovery, Ga4Snapshot } from '@/types/ga4';
import { parseGa4Discovery, parseGa4Snapshot, validateGa4DateRange } from './contracts';

export type Ga4Invoker = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
export interface Ga4AuthInput { projectId: string; clientId: string; clientSecret?: string; }
export interface Ga4SiteInput extends Ga4AuthInput { siteUrl: string; }
export interface Ga4PerformanceInput extends Ga4SiteInput, Ga4DateRange {}

const required = (value: string, field: string): string => {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Google Analytics ${field} is required.`);
  return normalized;
};

const authArgs = (input: Ga4AuthInput): Record<string, unknown> => {
  const projectId = required(input.projectId, 'project');
  const clientId = required(input.clientId, 'client ID');
  const secret = input.clientSecret?.trim();
  return { projectId, clientId, ...(secret ? { clientSecret: secret } : {}) };
};

export async function connectGoogleAnalytics(input: Ga4AuthInput, invoke: Ga4Invoker = invokeTauriCommand): Promise<unknown> {
  return invoke('connect_google_analytics', authArgs(input));
}

export async function listGoogleAnalyticsProperties(input: Ga4SiteInput, invoke: Ga4Invoker = invokeTauriCommand): Promise<Ga4Discovery> {
  const siteUrl = required(input.siteUrl, 'site URL');
  const raw = await invoke<unknown>('list_google_analytics_properties', { ...authArgs(input), siteUrl });
  return parseGa4Discovery(raw);
}

export async function fetchGoogleAnalyticsPerformance(input: Ga4PerformanceInput, invoke: Ga4Invoker = invokeTauriCommand): Promise<Ga4Snapshot> {
  const siteUrl = required(input.siteUrl, 'site URL');
  const range: Ga4DateRange = { startDate: input.startDate, endDate: input.endDate };
  const error = validateGa4DateRange(range);
  if (error) throw new Error(error);
  const args = { ...authArgs(input), siteUrl, startDate: range.startDate, endDate: range.endDate };
  const raw = await invoke<unknown>('google_analytics_performance', args);
  return parseGa4Snapshot(raw);
}
