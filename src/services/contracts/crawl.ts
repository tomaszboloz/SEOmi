// Re-export facade preserving all contracts and runtime schemas.
export {
  CustomSearchDefinitionSchema,
  CrawlConfigSchema,
} from './crawl/crawlConfig';

export {
  CrawledDiscoverySourceSchema,
  CrawledRedirectHopSchema,
  CrawledCanonicalTargetSchema,
  CrawledClientRedirectSchema,
  CrawledHreflangSchema,
  CrawledPaginationLinkSchema,
} from './crawl/crawlNavigation';

export {
  CrawledRobotsDecisionSchema,
  CrawledIndexabilityVerdictSchema,
  CrawledContentTermSchema,
  CrawledFocusPhraseEvidenceSchema,
  CrawledLinkSchema,
  CrawledSchemaReferenceSchema,
  StructuredDataValidationIssueSchema,
  CrawledSchemaFindingSchema,
  CrawledHtmlValidationFindingSchema,
  CrawledDuplicateHeadingSchema,
  IssueSeveritySchema,
  CrawledPageIssueSchema,
  CrawledCustomSearchResultSchema,
} from './crawl/crawlFindings';

export {
  CrawledImageResourceCheckSchema,
  CrawledImageSchema,
  CrawledFrameSchema,
  FaviconDataSchema,
  CrawledSocialResourceCheckSchema,
  CrawledSocialMetaTagSchema,
} from './crawl/crawlMedia';

export {
  CrawledPageSummarySchema,
  CrawledResourceSchema,
} from './crawl/crawlSummary';

export {
  SiteCrawlResultSchema,
  CrawlRunRecordSchema,
} from './crawl/crawlResult';
