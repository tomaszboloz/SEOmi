import { MAX_TRENDING_ENTRIES } from './contracts';

/** Strict RFC-style comma CSV, including quoted newlines and escaped quotes. */
export function trendingCsvRows(payload: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let closed = false;
  const finishRow = () => {
    row.push(cell);
    if (row.some((value) => value !== '')) rows.push(row);
    if (rows.length > MAX_TRENDING_ENTRIES + 1) throw new Error('Trending Now CSV exceeds the entry limit');
    row = []; cell = ''; closed = false;
  };
  const text = payload.replace(/^\uFEFF/, '');
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') { quoted = false; closed = true; }
      else cell += char;
    } else if (char === ',') {
      row.push(cell); cell = ''; closed = false;
    } else if (char === '\r' || char === '\n') {
      finishRow();
      if (char === '\r' && text[index + 1] === '\n') index += 1;
    } else if (char === '"' && cell === '' && !closed) quoted = true;
    else {
      if (closed || char === '"') throw new Error('Invalid Trending Now CSV quoting');
      cell += char;
    }
  }
  if (quoted) throw new Error('Unclosed Trending Now CSV quote');
  if (cell || row.length || closed) finishRow();
  return rows;
}

export function trendingCsvEntries(payload: string): unknown[] {
  const [header, ...rows] = trendingCsvRows(payload);
  if (!header) throw new Error('Trending Now CSV header is missing');
  const names = header.map((name) => name.toLowerCase().replace(/[\s_-]/g, ''));
  const column = (aliases: string[]) => {
    const matches = names.flatMap((name, index) => aliases.includes(name) ? [index] : []);
    if (matches.length > 1) throw new Error('Ambiguous Trending Now CSV header');
    return matches[0] ?? -1;
  };
  const keyword = column(['keyword', 'trend', 'trends']);
  const traffic = column(['trafficlabel', 'searchvolume', 'traffic']);
  const started = column(['startedat', 'started', 'pubdate']);
  if (keyword < 0) throw new Error('Trending Now CSV keyword column is missing');
  return rows.map((row) => {
    if (row.length !== header.length) throw new Error('Invalid Trending Now CSV column count');
    return { keyword: row[keyword], trafficLabel: row[traffic], startedAt: row[started] };
  });
}
