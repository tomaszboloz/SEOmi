import { ga4RevenueToImport, type Ga4RevenueError } from '@/services/urlTelemetry/ga4Revenue';
import type { RevenueImport } from '@/services/urlTelemetry/revenue';

export interface Ga4RevenueInput { projectId: string; clientId: string; siteUrl: string; startDate: string; endDate: string }
export type RevenueInvoker = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

/** Desktop command `google_analytics_revenue`; the clock is injected so imports are reproducible in tests. */
export const fetchGa4Revenue = async (input: Ga4RevenueInput, now: Date = new Date(), invoke: RevenueInvoker = async (command, args) => (await import('@/services/tauri')).invokeTauriCommand(command, args)): Promise<RevenueImport | Ga4RevenueError> =>
  ga4RevenueToImport(await invoke<unknown>('google_analytics_revenue', { ...input }), now);
