/**
 * Every constant records the measurement that set it. The reference crawl is
 * rafalszymanski.pl on 2026-10-06: 211 pages, 103 of them English versions
 * under /en/, 100 reciprocal hreflang pairs. See the design note of 2026-10-10.
 */

/** Same ceiling as the semantic graph; pairwise work stays bounded. */
export const MAX_DIAGNOSIS_PAGES = 500;

/** Weighted-Jaccard floor for topic edges. 0.16 left 101 of 211 pages alone; 0.08 formed 55 topics. */
export const TOPIC_SIMILARITY_FLOOR = 0.08;
export const TOPIC_MIN_SHARED_TERMS = 2;
/** Pairs above the floor kept for clustering; more than this marks the report truncated. */
export const MAX_TOPIC_PAIRS = 5_000;

/** A term on more than this share of content documents describes the site ("linkedin" was on 40%). */
export const SITE_WIDE_TERM_SHARE = 0.25;
/** Below this many content documents the document frequency says nothing, so the ceiling is off. */
export const MIN_DOCUMENTS_FOR_CEILING = 10;

/** A page linking to at least this many same-section documents is a listing (category pages linked 15). */
export const HUB_MIN_LINKED_DOCUMENTS = 5;
/** Listings have little text per link: a category page had 212 words for 15 links. */
export const HUB_MAX_WORDS_PER_LINK = 60;

export const LABEL_MAX_TOKENS = 3;
/** A title token must appear on this share of the members (at least two) to label a topic. */
export const LABEL_MIN_COVERAGE_SHARE = 0.4;

/** Same values as the semantic audit's similarity checks. */
export const CANNIBALIZATION_MIN_JACCARD = 0.55;
export const CANNIBALIZATION_MIN_TITLE_TOKENS = 3;
export const NEAR_DUPLICATE_MAX_HAMMING = 7;

/** Pairs or URLs listed in one verdict before the count takes over. */
export const MAX_LISTED_PAIRS = 10;

export const UTILITY_PATH_PATTERN =
  /(^|\/)(kontakt|contact|regulamin|terms(-and)?-conditions|polityka-prywatnosci|privacy(-policy)?|cookies?|dla-mediow|press(-pack)?|404)(\/|$)/i;

/** Social networks named by share buttons that sit inside the main content. */
export const BRAND_TOKEN_PATTERN = /^(facebook|twitter|instagram|youtube|tiktok)$/;
