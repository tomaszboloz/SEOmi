/** Heading-delimited block of main content (text capped by the crawler) for the Information Gain score. */
export interface ContentSection {
  /** Empty for the intro before the first heading. */
  heading: string;
  /** 0 for the intro, otherwise heading level 1-3. */
  level: number;
  text: string;
  /** Words in the whole block, not only the capped text. */
  words: number;
  tables: number;
  lists: number;
}
