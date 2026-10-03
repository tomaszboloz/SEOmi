import type { RenderedPageArtifact } from '@/types';
import i18n from '@/i18n';
import { invokeTauriCommand } from './transport';

export async function captureRenderedArtifact(args: {
  url: string;
  allowSubdomains: boolean;
  scopePath?: string;
  waitForSelector?: string;
  waitDelayMs?: number;
  lazyScrollCycles?: number;
  kind: 'screenshot' | 'pdf';
  runId?: string;
}): Promise<RenderedPageArtifact> {
  return invokeTauriCommand<RenderedPageArtifact>('capture_rendered_artifact', {
    url: args.url,
    allowSubdomains: args.allowSubdomains,
    scopePath: args.scopePath || null,
    waitForSelector: args.waitForSelector || null,
    waitDelayMs: args.waitDelayMs ?? 0,
    lazyScrollCycles: args.lazyScrollCycles ?? 0,
    kind: args.kind,
    runId: args.runId || null,
  });
}

export async function openRenderedElementPreview(args: {
  url: string;
  selector: string;
  needle?: string;
  /** Zero-based index inside querySelectorAll(selector), useful for controls
   * whose DOM nodes have no stable id/name or visible text. */
  domIndex?: number;
}): Promise<void> {
  const host = (() => {
    try { return new URL(args.url).host; } catch { return ''; }
  })();
  await invokeTauriCommand('open_rendered_element_preview', {
    url: args.url,
    selector: args.selector,
    needle: args.needle || null,
    domIndex: Number.isInteger(args.domIndex) && (args.domIndex as number) >= 0 ? args.domIndex : null,
    previewTitle: i18n.t('componentUi.previewWindowTitle', { host }),
    notFoundMessage: i18n.t('componentUi.previewNotFound'),
  });
}

