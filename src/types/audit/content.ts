export interface KeywordStat {
  keyword: string;
  count: number;
  /** Percentage of normalized body-word tokens; local deterministic calculation. */
  density_percent?: number;
}

export interface ContentStats {
  word_count: number;
  reading_time_minutes: number;
  text_ratio_percent: number;
  top_keywords: KeywordStat[];
  /** Values are absent in audits created before local complexity metrics were added. */
  sentence_count?: number;
  average_words_per_sentence?: number;
  average_characters_per_word?: number;
  complexity_score?: number;
  complexity_label?: 'simple' | 'moderate' | 'complex' | 'unavailable';
  readability_ease_score?: number;
  readability_grade?: number;
  readability_method?: string;
  readability_label?: string;
  /** Normalized text from the audited document body, never raw HTML. */
  body_text?: string;
  /** The local stored text was capped; phrase counts apply to the retained portion. */
  body_text_truncated?: boolean;
}

export interface IndexabilityAssessment {
  /** Deterministic local verdict: indexable, blocked, or uncertain. */
  status: 'indexable' | 'blocked' | 'uncertain';
  reasons: string[];
  meta_robots?: string;
  x_robots_tag?: string;
  canonical?: string;
  canonical_matches_final_url?: boolean;
  canonical_target_checked?: boolean;
  canonical_target_status?: number;
  canonical_target_check_error?: string;
}
