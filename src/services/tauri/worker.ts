import { invokeTauriCommand } from './transport';

export interface RenderWorkerLease {
  baseUrl: string;
  token: string;
  version: string;
  expiresAt: string;
  oneShot: boolean;
}

/**
 * Starts the explicit, loopback-only renderer bridge. The lease is intentionally
 * one-shot and short-lived; callers must not persist the token or expose it in
 * a URL/log. The worker is optional and is never installed or started in the
 * background.
 */
export function startRenderWorker(): Promise<RenderWorkerLease> {
  return invokeTauriCommand<RenderWorkerLease>('start_render_worker');
}

export function stopRenderWorker(): Promise<void> {
  return invokeTauriCommand<void>('stop_render_worker');
}

export function getRenderWorkerStatus(): Promise<boolean> {
  return invokeTauriCommand<boolean>('render_worker_status');
}

