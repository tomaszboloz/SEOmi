export interface UpdateStatus {
  available: boolean;
  installed: boolean;
  restart_required: boolean;
  version: string | null;
  current_version: string;
}

export { isTauriEnvironment, invokeTauriCommand } from './tauri/transport';
export { saveTextFile, type SaveTextFileOptions } from './tauri/files';
export { getSecureValue, setSecureValue } from './tauri/secrets';
export { captureRenderedArtifact, openRenderedElementPreview } from './tauri/rendered';
export { startRenderWorker, stopRenderWorker, getRenderWorkerStatus, type RenderWorkerLease } from './tauri/worker';
