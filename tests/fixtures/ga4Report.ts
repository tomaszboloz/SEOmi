import type { Ga4Report } from '@/types/ga4';

export const ga4Report = (extra: Partial<Ga4Report> = {}): Ga4Report => ({
  property: 'properties/1',
  start_date: '2026-07-01',
  end_date: '2026-07-28',
  rows: [{ host_name: 'example.com', landing_page: '/', sessions: 10, engaged_sessions: 8, key_events: 2 }],
  may_be_truncated: false,
  row_count: 1,
  ...extra,
});
