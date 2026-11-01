import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri/transport';
import { reserveMonitoringAlert, type MonitoringReservation } from './persistence';
import { validMonitoringProject } from './policy';
import type { MonitoringAlert, MonitoringAlertSettings } from './types';

/**
 * Thin consumer of the native delivery ledger (#98). In the desktop app the Rust scheduler side decides whether an
 * alert was delivered (fingerprint, frequency window, in-flight reservation) and records the delivery; the local
 * history stays as the mirror the settings panel shows. If the native call fails the local ledger decides, so an
 * alert is never lost and never delivered twice by one window.
 */
export interface AsyncReservation { duplicate: boolean; finish: (delivered: boolean) => Promise<boolean> }
type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

const wrap = (reservation: MonitoringReservation): AsyncReservation => ({ duplicate: reservation.duplicate, finish: async (delivered) => reservation.finish(delivered) });

export const reserveDispatch = async (projectId: string, alert: MonitoringAlert, settings: MonitoringAlertSettings, native = isTauriEnvironment, invoke: Invoke = invokeTauriCommand): Promise<AsyncReservation | null> => {
  if (!validMonitoringProject(projectId) || !settings.enabled || !settings.types[alert.type]) return null;
  const ids = { projectId, fingerprint: alert.fingerprint, alertType: alert.type, frequency: settings.frequency };
  let remote: boolean;
  try {
    if (!native()) throw new Error('browser');
    remote = await invoke<boolean>('reserve_monitoring_alert', ids);
  } catch {
    const local = reserveMonitoringAlert(projectId, alert, settings);
    return local && wrap(local);
  }
  const local = remote ? null : reserveMonitoringAlert(projectId, alert, settings);
  if (remote || !local || local.duplicate) {
    if (!remote) await invoke('finish_monitoring_alert', { ...ids, occurredAt: null }).catch(() => false);
    return { duplicate: true, finish: async () => false };
  }
  return {
    duplicate: false,
    finish: async (delivered) => {
      const saved = local.finish(delivered);
      const recorded = await invoke<boolean>('finish_monitoring_alert', { ...ids, occurredAt: delivered ? alert.occurredAt : null }).catch(() => false);
      return saved || recorded;
    },
  };
};
