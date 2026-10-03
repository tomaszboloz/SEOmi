import { downloadBlob } from '@/services/download';
import { invokeTauriCommand, isTauriEnvironment } from './transport';

export interface SaveTextFileOptions {
  defaultPath: string;
  contents: string;
  extension: 'json' | 'toml';
  filterName: string;
}

/**
 * Saves a user-selected text export through the native system dialog when the
 * desktop shell is present. Browser preview keeps the same explicit action by
 * downloading the file, without pretending that Web Storage is a safe file
 * system or forwarding credentials anywhere.
 */
export async function saveTextFile(options: SaveTextFileOptions): Promise<'saved' | 'cancelled' | 'downloaded'> {
  if (!isTauriEnvironment()) {
    downloadBlob(options.defaultPath, new Blob([options.contents], { type: `${options.extension === 'json' ? 'application/json' : 'text/plain'};charset=utf-8` }));
    return 'downloaded';
  }

  const { save } = await import('@tauri-apps/plugin-dialog');
  const path = await save({
    defaultPath: options.defaultPath,
    filters: [{ name: options.filterName, extensions: [options.extension] }],
  });
  if (!path) return 'cancelled';
  await invokeTauriCommand('write_mcp_config_file', { path, contents: options.contents });
  return 'saved';
}

