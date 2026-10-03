export type AiProvider = 'openai' | 'claude' | 'gemini';

export type AiConnectionMethod = 'api_key' | 'local_cli';

export type AiConnectionState = 'unconfigured' | 'testing' | 'connected' | 'error';

export interface AiAccountConfig {
  provider: AiProvider;
  name: string;
  model: string;
  isConnected: boolean;
  status: AiConnectionState;
  statusMessage?: string;
}

export interface UserSubscription {
  tier: 'direct';
}

export interface AiCliStatus {
  provider: AiProvider;
  command: string;
  available: boolean;
  detail: string;
}

// -------------------------------------------------------------
// AI Visibility & GEO Models
// -------------------------------------------------------------
export interface AiResearchObservation {
  prompt?: string;
  repetition?: number;
  search_mode?: 'web_enabled' | 'model_knowledge';
  mention_position?: number | null;
  own_domain_cited?: boolean;
  competitors_mentioned?: string[];
}

export interface AiModelPresence extends AiResearchObservation {
  model_name: string;
  model_id: string | null;
  is_present: boolean;
  visibility_percentage: number;
  sentiment: 'positive' | 'neutral' | 'negative' | 'not_mentioned' | 'not_assessed';
  summary: string;
  cited_sources: string[];
  provider: AiProvider;
  connection_method: 'local_cli';
  captured_at: string;
  response_status: 'success' | 'error';
  error_message?: string;
}

export interface BrandAiVisibilityReport {
  methodology?: 'unbranded_prompts';
  prompts?: string[];
  repetitions?: number;
  competitors?: string[];
  share_of_voice?: number | null;
  brand: string;
  domain: string;
  overall_score: number | null;
  models: AiModelPresence[];
  query_checked: string;
  timestamp: string;
  key_takeaways: string[];
}

export interface AiPromptComparisonResult extends AiResearchObservation {
  model_name: string;
  response_text: string;
  brand_mentions: string[];
  citations: string[];
  provider: AiProvider;
  connection_method: 'local_cli';
  captured_at: string;
  response_status: 'success' | 'error';
  error_message?: string;
}

export interface AiPromptComparison {
  prompt: string;
  captured_at: string;
  results: AiPromptComparisonResult[];
}
