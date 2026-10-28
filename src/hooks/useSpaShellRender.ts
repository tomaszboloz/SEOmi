import { useCallback, useEffect, useRef, useState } from 'react';
import type { CrawledPageSummary, RenderedPageSnapshot } from '@/types';
import { compareShellRender, type ShellRenderComparison } from '@/services/spaRender/compare';
import { renderCrawlPage } from '@/services/tauri/rendered';

/** Each render opens a WebView for up to a minute; keep the on-demand batch small. */
export const MAX_SHELL_RENDERS = 10;

export type ShellRenderRow =
  | { url: string; status: 'pending' | 'rendering' | 'cancelled' }
  | { url: string; status: 'done'; comparison: ShellRenderComparison }
  | { url: string; status: 'error'; error: string };

export interface ShellRenderState { rows: ShellRenderRow[]; running: boolean; start: () => void; cancel: () => void }

type Renderer = (url: string) => Promise<RenderedPageSnapshot>;
const defaultRenderer: Renderer = (url) => renderCrawlPage({ url });

/** Renders flagged JS-shell pages one at a time, so the user can compare static HTML with the browser DOM. */
export const useSpaShellRender = (shells: CrawledPageSummary[], render: Renderer = defaultRenderer): ShellRenderState => {
  const [rows, setRows] = useState<ShellRenderRow[]>([]);
  const [running, setRunning] = useState(false);
  const token = useRef(0);

  // A new page list (another crawl) invalidates rows and stops an ongoing batch.
  useEffect(() => { token.current += 1; setRows([]); setRunning(false); }, [shells]);

  const cancel = useCallback(() => {
    token.current += 1;
    setRunning(false);
    setRows((current) => current.map((row) => (row.status === 'pending' || row.status === 'rendering' ? { url: row.url, status: 'cancelled' } : row)));
  }, []);

  const start = useCallback(() => {
    const batch = shells.slice(0, MAX_SHELL_RENDERS);
    const mine = ++token.current;
    const update = (url: string, row: ShellRenderRow) => {
      if (token.current === mine) setRows((current) => current.map((item) => (item.url === url ? row : item)));
    };
    setRows(batch.map((page) => ({ url: page.url, status: 'pending' })));
    setRunning(true);
    void (async () => {
      for (const page of batch) {
        if (token.current !== mine) return;
        update(page.url, { url: page.url, status: 'rendering' });
        try {
          update(page.url, { url: page.url, status: 'done', comparison: compareShellRender(page, await render(page.url)) });
        } catch (error) {
          update(page.url, { url: page.url, status: 'error', error: error instanceof Error ? error.message : String(error) });
        }
      }
      if (token.current === mine) setRunning(false);
    })();
  }, [shells, render]);

  return { rows, running, start, cancel };
};
