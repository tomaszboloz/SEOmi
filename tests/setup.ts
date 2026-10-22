// Vitest setup file
import { afterEach } from 'vitest';

// jsdom cannot navigate. Following a link would log "Not implemented: navigation" on every anchor click,
// so cancel the default action of real links here; handlers and tests still observe the click.
if (typeof document !== 'undefined') {
  document.addEventListener('click', (event) => {
    const anchor = (event.target as Element | null)?.closest?.('a[href]');
    const href = anchor?.getAttribute('href') ?? '';
    if (anchor && href !== '' && !href.startsWith('#')) event.preventDefault();
  });
}

afterEach(() => {
  if (typeof localStorage !== 'undefined') localStorage.clear();
});
