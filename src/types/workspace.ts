export interface AppConfig {
  theme: 'dark' | 'light' | 'system';
  language: string;
  default_user_agent: string;
  request_timeout_secs: number;
  max_redirects: number;
  verify_ssl: boolean;
  ai_provider: 'openai' | 'claude' | 'gemini';
  ai_model?: string;
  auto_check_updates: boolean;
  auto_install_updates: boolean;
}

export interface SeoProject {
  id: string;
  name: string;
  rootUrl?: string;
  createdAt: string;
  lastOpenedAt: string;
}

export type TabType =
  | 'overview'
  | 'social'
  | 'headings'
  | 'metadata'
  | 'images'
  | 'links'
  | 'security'
  | 'structured'
  | 'amp'
  | 'performance'
  | 'dataforseo'
  | 'keyword-research'
  | 'keyword-clustering'
  | 'core-web-vitals'
  | 'saved-keywords'
  | 'rank-tracking'
  | 'domain-overview'
  | 'backlink-checker'
  | 'site-audit'
  | 'ai-brand-visibility'
  | 'ai-search-prompts'
  | 'mcp-hub'
  | 'search-console'
  | 'seo-tools';
