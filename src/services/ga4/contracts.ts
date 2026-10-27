import type { Ga4DateRange, Ga4Discovery, Ga4Property, Ga4Report, Ga4ReportRow, Ga4Snapshot, Ga4Status } from '@/types/ga4';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const statuses = new Set<Ga4Status>(['complete', 'missing', 'partial']);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Google Analytics response has an invalid ${field}.`);
  return value.trim();
};
const finiteMetric = (value: unknown, field: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`Google Analytics response has an invalid ${field}.`);
  return value;
};
const count = (value: unknown, field: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(`Google Analytics response has an invalid ${field}.`);
  return value as number;
};
const statusOf = (value: unknown): Ga4Status => {
  if (typeof value !== 'string' || !statuses.has(value as Ga4Status)) throw new Error('Google Analytics returned an invalid report status.');
  return value as Ga4Status;
};

export const validateGa4DateRange = (range: Ga4DateRange): string | null => {
  const valid = (value: string) => DATE.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);
  if (!valid(range.startDate) || !valid(range.endDate) || range.startDate > range.endDate) return 'Google Analytics date range is invalid.';
  return null;
};

export const parseGa4Property = (value: unknown): Ga4Property => {
  if (!record(value)) throw new Error('Google Analytics returned an invalid property.');
  const urls = value.stream_urls;
  if (!Array.isArray(urls) || urls.some((url) => typeof url !== 'string' || !url.trim())) throw new Error('Google Analytics returned invalid stream URLs.');
  const streamUrls = [...new Set(urls.map((url) => url.trim()))];
  const display = value.display_name === null || value.display_name === undefined ? null : text(value.display_name, 'property display name');
  return { name: text(value.name, 'property name'), display_name: display, stream_urls: streamUrls };
};

export const parseGa4Properties = (raw: unknown): Ga4Property[] => {
  const values = Array.isArray(raw) ? raw : record(raw) && Array.isArray(raw.properties) ? raw.properties : null;
  if (!values) throw new Error('Google Analytics properties response is malformed.');
  return values.map(parseGa4Property);
};

export const parseGa4Discovery = (raw: unknown): Ga4Discovery => {
  if (!record(raw) || !('property' in raw) || typeof raw.may_be_truncated !== 'boolean') throw new Error('Google Analytics discovery response is malformed.');
  const property = raw.property === null ? null : parseGa4Property(raw.property);
  return {
    status: statusOf(raw.status),
    property,
    account_pages: count(raw.account_pages, 'account pages'),
    stream_pages: count(raw.stream_pages, 'stream pages'),
    candidates_checked: count(raw.candidates_checked, 'candidate count'),
    may_be_truncated: raw.may_be_truncated,
  };
};

const parseRow = (value: unknown): Ga4ReportRow => {
  if (!record(value)) throw new Error('Google Analytics returned an invalid report row.');
  return {
    host_name: text(value.host_name, 'report host'),
    landing_page: text(value.landing_page, 'landing page'),
    sessions: finiteMetric(value.sessions, 'sessions'),
    engaged_sessions: finiteMetric(value.engaged_sessions, 'engaged sessions'),
    key_events: finiteMetric(value.key_events, 'key events'),
  };
};

export const parseGa4Report = (raw: unknown): Ga4Report => {
  if (!record(raw) || !Array.isArray(raw.rows) || typeof raw.may_be_truncated !== 'boolean') throw new Error('Google Analytics report response is malformed.');
  const range = { startDate: text(raw.start_date, 'report start date'), endDate: text(raw.end_date, 'report end date') };
  const rangeError = validateGa4DateRange(range);
  if (rangeError) throw new Error(rangeError);
  if (!('row_count' in raw)) throw new Error('Google Analytics returned an invalid report row count.');
  const rowCount = raw.row_count === null ? null : raw.row_count;
  if (rowCount !== null && (!Number.isSafeInteger(rowCount) || (rowCount as number) < 0)) throw new Error('Google Analytics returned an invalid report row count.');
  const status = raw.status === undefined ? undefined : statusOf(raw.status);
  return {
    property: text(raw.property, 'report property'),
    start_date: range.startDate,
    end_date: range.endDate,
    rows: raw.rows.map(parseRow),
    may_be_truncated: raw.may_be_truncated,
    row_count: rowCount === null ? null : rowCount as number,
    ...(status ? { status } : {}),
    ...(typeof raw.host_name === 'string' && raw.host_name.trim() ? { host_name: raw.host_name.trim() } : {}),
    ...(Number.isSafeInteger(raw.pages) && (raw.pages as number) >= 0 ? { pages: raw.pages as number } : {}),
  };
};

export const parseGa4Snapshot = (raw: unknown): Ga4Snapshot => {
  if (!record(raw) || !('report' in raw)) throw new Error('Google Analytics snapshot response is malformed.');
  const startDate = text(raw.start_date, 'snapshot start date');
  const endDate = text(raw.end_date, 'snapshot end date');
  const rangeError = validateGa4DateRange({ startDate, endDate });
  if (rangeError) throw new Error(rangeError);
  const report = raw.report === null ? null : parseGa4Report(raw.report);
  if (report && (report.start_date !== startDate || report.end_date !== endDate)) throw new Error('Google Analytics report period does not match its snapshot.');
  return { status: statusOf(raw.status), start_date: startDate, end_date: endDate, discovery: parseGa4Discovery(raw.discovery), report };
};
