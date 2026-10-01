type Translate = (key: string) => string;
export interface CruxMetric {
  metric?: string;
  percentiles?: { p75?: unknown };
  histogram?: Array<{ density: number }>;
}

const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

const percentile = (value: unknown): number | null => {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^[+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
};

export const readCruxMetrics = (response: unknown): Record<string, CruxMetric> | null => {
  const metrics = object(object(object(response)?.record)?.metrics);
  if (!metrics) return null;
  return Object.fromEntries(Object.entries(metrics).flatMap(([name, value]) => {
    const metric = object(value);
    if (!metric) return [];
    const p75 = object(metric.percentiles)?.p75;
    const bins = Array.isArray(metric.histogram) ? metric.histogram : [];
    const validBins = bins.every((bin) => {
      const density = object(bin)?.density;
      return typeof density === 'number' && Number.isFinite(density) && density >= 0 && density <= 1;
    });
    return [[name, { percentiles: { p75 }, histogram: validBins ? bins.map((bin) => ({ density: object(bin)!.density as number })) : [] }]];
  }));
};

export const formatCruxValue = (metric: CruxMetric, t: Translate): string => {
  const value = percentile(metric.percentiles?.p75);
  if (value === null) return t('pageSpeedUi.noP75');
  return metric.metric === 'cumulative_layout_shift' ? value.toFixed(3) : `${Math.round(value)} ${t('pageSpeedUi.ms')}`;
};

export const cruxCategory = (metric: CruxMetric, t: Translate): string => {
  const value = percentile(metric.percentiles?.p75);
  const thresholds: Record<string, [number, number]> = {
    largest_contentful_paint: [2500, 4000], interaction_to_next_paint: [200, 500],
    cumulative_layout_shift: [0.1, 0.25], first_contentful_paint: [1800, 3000], experimental_time_to_first_byte: [800, 1800],
  };
  const bounds = Object.prototype.hasOwnProperty.call(thresholds, metric.metric ?? '') ? thresholds[metric.metric ?? ''] : undefined;
  if (value === null || !bounds) return t('pageSpeedUi.crux.unrated');
  return t(value <= bounds[0] ? 'pageSpeedUi.crux.good' : value <= bounds[1] ? 'pageSpeedUi.crux.needsImprovement' : 'pageSpeedUi.crux.poor');
};

const date = (value: unknown): string | null => {
  const record = object(value);
  if (!record) return null;
  const { year, month, day } = record;
  if (typeof year !== 'number' || typeof month !== 'number' || typeof day !== 'number'
    || ![year, month, day].every(Number.isInteger) || year < 1970 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const stamp = new Date(Date.UTC(year, month - 1, day));
  if (stamp.getUTCMonth() !== month - 1 || stamp.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export const formatCruxCollectionPeriod = (response: unknown): string | null => {
  const period = object(object(object(response)?.record)?.collectionPeriod);
  const first = date(period?.firstDate);
  const last = date(period?.lastDate);
  return first && last && first <= last ? `${first} – ${last}` : null;
};
