import type { CrawledPageSummary } from '@/types';

export type MetadataFacet =
  | 'all'
  | 'missing-title'
  | 'empty-title'
  | 'title-length'
  | 'duplicate-title'
  | 'missing-description'
  | 'empty-description'
  | 'description-length'
  | 'duplicate-description';

export const metadataFacetOptions: Array<{
  id: MetadataFacet;
  labelKey: string;
  descriptionKey: string;
}> = [
  { id: 'all', labelKey: 'all', descriptionKey: 'allDescription' },
  {
    id: 'missing-title',
    labelKey: 'missingTitle',
    descriptionKey: 'missingTitleDescription',
  },
  {
    id: 'empty-title',
    labelKey: 'emptyTitle',
    descriptionKey: 'emptyTitleDescription',
  },
  {
    id: 'title-length',
    labelKey: 'titleLength',
    descriptionKey: 'titleLengthDescription',
  },
  {
    id: 'duplicate-title',
    labelKey: 'duplicateTitle',
    descriptionKey: 'duplicateTitleDescription',
  },
  {
    id: 'missing-description',
    labelKey: 'missingDescription',
    descriptionKey: 'missingDescriptionDescription',
  },
  {
    id: 'empty-description',
    labelKey: 'emptyDescription',
    descriptionKey: 'emptyDescriptionDescription',
  },
  {
    id: 'description-length',
    labelKey: 'descriptionLength',
    descriptionKey: 'descriptionLengthDescription',
  },
  {
    id: 'duplicate-description',
    labelKey: 'duplicateDescription',
    descriptionKey: 'duplicateDescriptionDescription',
  },
];

export const metadataFacetIds = new Set<MetadataFacet>(
  metadataFacetOptions.map((facet) => facet.id),
);

export const issueMessageIncludes = (
  page: CrawledPageSummary,
  needle: string,
): boolean =>
  page.issues.some((issue) =>
    issue.message.toLocaleLowerCase().includes(needle),
  );

export const metadataFacetsForPage = (page: CrawledPageSummary): MetadataFacet[] => {
  if (
    page.content_type &&
    !page.content_type.toLocaleLowerCase().includes('html')
  ) {
    return [];
  }
  const facets: MetadataFacet[] = [];
  const title = typeof page.title === 'string' ? page.title : undefined;
  const metaDescription =
    typeof page.meta_description === 'string'
      ? page.meta_description
      : undefined;

  if (title === undefined) facets.push('missing-title');
  else if (title.trim() === '') facets.push('empty-title');

  if (
    title !== undefined &&
    title.trim() !== '' &&
    page.title_length != null &&
    !(page.title_length >= 30 && page.title_length <= 60)
  ) {
    facets.push('title-length');
  } else if (
    title !== undefined &&
    title.trim() !== '' &&
    issueMessageIncludes(page, 'title length is')
  ) {
    facets.push('title-length');
  }

  if (issueMessageIncludes(page, 'duplicate title'))
    facets.push('duplicate-title');

  if (issueMessageIncludes(page, 'missing meta description')) {
    facets.push('missing-description');
  } else if (issueMessageIncludes(page, 'meta description is empty')) {
    facets.push('empty-description');
  } else if (metaDescription === undefined) {
    facets.push('missing-description');
  }

  if (
    metaDescription !== undefined &&
    metaDescription.trim() !== '' &&
    page.meta_description_length != null &&
    !(page.meta_description_length >= 70 && page.meta_description_length <= 160)
  ) {
    facets.push('description-length');
  } else if (
    metaDescription !== undefined &&
    metaDescription.trim() !== '' &&
    issueMessageIncludes(page, 'meta description length is')
  ) {
    facets.push('description-length');
  }

  if (issueMessageIncludes(page, 'duplicate meta description'))
    facets.push('duplicate-description');

  return facets;
};
