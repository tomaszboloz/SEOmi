/** Access-log line parser (#92). Handles Nginx/Apache "combined" lines with an optional trailing request time. */
export interface LogHit {
  /** UTC epoch ms, from the line's own timezone offset. */
  at: number;
  ip: string;
  path: string;
  status: number;
  bytes: number | null;
  userAgent: string;
  latencyMs: number | null;
}

export interface ParseOptions {
  /** Unit of an optional trailing request-time field: nginx $request_time is seconds, Apache %D is microseconds. */
  latencyUnit?: 'seconds' | 'microseconds' | 'none';
  /** Keep the query string. Default strips it (parameters can carry private data). */
  keepQuery?: boolean;
}

const LINE = /^(\S+) \S+ \S+ \[(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})\] "(?:[A-Z]+) (\S+)(?: [^"]*)?" (\d{3}) (\d+|-) "[^"]*" "([^"]*)"(?: (\d+(?:\.\d+)?))?\s*$/;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export const parseLogLine = (line: string, options: ParseOptions = {}): LogHit | null => {
  const m = LINE.exec(line);
  if (!m) return null;
  const month = MONTHS.indexOf(m[3].toLowerCase());
  const [day, year, hh, mm, ss] = [m[2], m[4], m[5], m[6], m[7]].map(Number);
  const offsetMin = (m[8] === '-' ? -1 : 1) * (Number(m[9]) * 60 + Number(m[10]));
  if (month < 0 || hh > 23 || mm > 59 || ss > 60 || day < 1 || day > 31) return null;
  const at = Date.UTC(year, month, day, hh, mm, ss) - offsetMin * 60_000;
  if (!Number.isFinite(at) || new Date(at + offsetMin * 60_000).getUTCDate() !== day) return null;
  const unit = options.latencyUnit ?? 'seconds';
  const raw = m[15] === undefined || unit === 'none' ? null : Number(m[15]);
  const path = options.keepQuery ? m[11] : m[11].split('?', 1)[0];
  return {
    at, ip: m[1], path, status: Number(m[12]), bytes: m[13] === '-' ? null : Number(m[13]), userAgent: m[14],
    latencyMs: raw === null ? null : unit === 'seconds' ? raw * 1000 : raw / 1000,
  };
};
