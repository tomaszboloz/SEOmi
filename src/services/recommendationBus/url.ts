/** Canonical key for comparing URLs across modules: no hash, no trailing slash (except root). */
export const busUrlKey = (value: string): string => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    url.hash = '';
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.href;
  } catch {
    return '';
  }
};
