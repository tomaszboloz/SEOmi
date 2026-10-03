import type { CrawledPageSummary } from '@/types';
import type { TFunction } from 'i18next';

export interface TimingBucket {
  label: string;
  count: number;
}

export interface TimingMetrics {
  timings: number[];
  buckets: TimingBucket[];
  median: number | undefined;
  renderedVitalsPages: CrawledPageSummary[];
}

export const calculateTimingMetrics = (
  pages: CrawledPageSummary[],
  t: TFunction,
): TimingMetrics => {
  const timings = pages
    .map((page) => page.response_time_ms)
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b);

  const buckets: TimingBucket[] = [
    {
      label: t('crawlDeepUi.timingUnder100'),
      count: timings.filter((value) => value < 100).length,
    },
    {
      label: t('crawlDeepUi.timing100To299'),
      count: timings.filter((value) => value >= 100 && value < 300).length,
    },
    {
      label: t('crawlDeepUi.timing300To999'),
      count: timings.filter((value) => value >= 300 && value < 1000).length,
    },
    {
      label: t('crawlDeepUi.timingOver1000'),
      count: timings.filter((value) => value >= 1000).length,
    },
  ];

  const median =
    timings.length === 0
      ? undefined
      : timings.length % 2 === 1
        ? timings[(timings.length - 1) / 2]
        : (timings[timings.length / 2 - 1] + timings[timings.length / 2]) / 2;

  const renderedVitalsPages = pages.filter(
    (page) =>
      page.rendered_lcp_ms !== undefined ||
      page.rendered_inp_ms !== undefined ||
      page.rendered_cls !== undefined,
  );

  return { timings, buckets, median, renderedVitalsPages };
};
