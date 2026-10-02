import type { CrawledPageSummary, CrawledImage } from '@/types';

export interface FlatCrawlImageItem {
  page: CrawledPageSummary;
  image: CrawledImage;
  key: string;
}

export const flattenPageImages = (pages: CrawledPageSummary[]): FlatCrawlImageItem[] => {
  return pages.flatMap((page) =>
    page.images.map((image: CrawledImage, index: number) => ({
      page,
      image,
      key: `${page.url}-${image.src}-${index}`,
    })),
  );
};
