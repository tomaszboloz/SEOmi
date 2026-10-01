import {
  BacklinkAnchorDistribution,
  BacklinkItem,
  BacklinkProfileData,
  BacklinkGapOpportunity,
  DataForSEOBacklinkSummary,
  DataForSEOSerpItem,
  DomainOverviewData,
  KeywordIdea,
  SearchIntent,
} from '@/types';
import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri';
import { readStorage, removeStorage, writeStorage } from '@/services/storage';
import { useProjectStore } from '@/stores/projectStore';
import i18n from '@/i18n';
import { DATAFORSEO_LOCATION_CATALOG, DataForSeoCatalogRow } from '@/services/dataforseoCatalog';

export { DATAFORSEO_LOCATION_CATALOG };

type JsonRecord = Record<string, unknown>;

export interface DataForSeoMarket {
  code: string;
  label: string;
  locationCode: number;
  countryIsoCode: string;
  locationType: 'Country' | 'Region';
  availableSources: string;
  languages: Array<{ code: string; label: string }>;
  /** Full provider rows retained for callers that need catalogue metadata. */
  catalogRows: DataForSeoCatalogRow[];
}

export interface DataForSeoPage<T> {
  items: T[];
  totalCount: number | null;
  referringSubnets?: number | null;
  rawCount?: number;
}

/** Metadata returned with a DataForSEO task. No credentials or response data are stored. */
export interface DataForSeoTaskMeta {
  endpoint: string;
  taskId: string | null;
  statusCode: number | null;
  statusMessage: string | null;
  cost: number | null;
  timeSeconds: number | null;
  resultCount: number | null;
  requestedAt: string;
  completedAt: string;
}

export interface DataForSeoTaskRecord extends DataForSeoTaskMeta {
  projectId: string;
  ok: boolean;
}

/**
 * A provider/network failure that can be shown without pretending that live
 * data exists. The native transport returns a string error, so the status is
 * also extracted from that message when the request runs inside Tauri.
 */
export class DataForSeoRequestError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
    readonly retryable = false,
    readonly quotaExceeded = false,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = 'DataForSeoRequestError';
  }
}

const DATAFORSEO_TASK_LOG_LIMIT = 100;
const dataForSeoTaskLogKey = (projectId: string) => `seomi_project_${projectId}_dataforseo_task_log_v1`;

const activeProjectForTaskLog = (): string | null => {
  try {
    const projectId = readStorage('seomi_active_project_v1') || useProjectStore.getState().activeProjectId || '';
    return /^[a-zA-Z0-9-]{1,80}$/.test(projectId) ? projectId : null;
  } catch {
    return null;
  }
};

export const readDataForSeoTaskLog = (projectId: string | null): DataForSeoTaskRecord[] => {
  if (!projectId) return [];
  try {
    const value: unknown = JSON.parse(readStorage(dataForSeoTaskLogKey(projectId)) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is DataForSeoTaskRecord => Boolean(
      item && typeof item === 'object' &&
      item.projectId === projectId && typeof item.endpoint === 'string' &&
      typeof item.requestedAt === 'string' && typeof item.completedAt === 'string' &&
      typeof item.ok === 'boolean',
    )).slice(0, DATAFORSEO_TASK_LOG_LIMIT);
  } catch {
    return [];
  }
};

export const clearDataForSeoTaskLog = (projectId: string | null): void => {
  if (!projectId) return;
  try {
    removeStorage(dataForSeoTaskLogKey(projectId));
  } catch {
    // Keep the live integration usable when storage is unavailable.
  }
};

export const appendDataForSeoTask = (meta: DataForSeoTaskMeta, projectId = activeProjectForTaskLog()): DataForSeoTaskRecord | null => {
  if (!projectId) return null;
  const record: DataForSeoTaskRecord = {
    ...meta,
    projectId,
    ok: meta.statusCode === 20000,
  };
  try {
    const next = [record, ...readDataForSeoTaskLog(projectId)].slice(0, DATAFORSEO_TASK_LOG_LIMIT);
    writeStorage(dataForSeoTaskLogKey(projectId), JSON.stringify(next));
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('seomi:dataforseo-task'));
  } catch {
    // Do not make a paid request fail because the local history quota is full.
  }
  return record;
};

const BACKLINK_PAGE_SIZE = 100;

const buildDataForSeoMarkets = (): DataForSeoMarket[] => {
  const grouped = new Map<string, DataForSeoMarket>();
  for (const row of DATAFORSEO_LOCATION_CATALOG) {
    const code = row.countryIsoCode.toUpperCase();
    const existing = grouped.get(code);
    const language = { code: row.languageCode, label: row.languageName };
    if (existing) {
      if (!existing.languages.some((item) => item.code === language.code)) existing.languages.push(language);
      existing.availableSources = Array.from(new Set(`${existing.availableSources},${row.availableSources}`.split(',').filter(Boolean))).join(',');
      existing.catalogRows.push(row);
      continue;
    }
    grouped.set(code, {
      code,
      label: row.locationName,
      locationCode: row.locationCode,
      countryIsoCode: row.countryIsoCode,
      locationType: row.locationType,
      availableSources: row.availableSources,
      languages: [language],
      catalogRows: [row],
    });
  }
  return Array.from(grouped.values()).sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }));
};

export let DATAFORSEO_MARKETS: DataForSeoMarket[] = buildDataForSeoMarkets();
i18n.on('languageChanged', () => { DATAFORSEO_MARKETS = buildDataForSeoMarkets(); });

/** All language codes present in the provider catalogue, useful for clients
 * that need a language-first filter before choosing a location. */
export const DATAFORSEO_LANGUAGES = Array.from(new Map(
  DATAFORSEO_LOCATION_CATALOG.map((row) => [row.languageCode, { code: row.languageCode, label: row.languageName }]),
).values()).sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }));

const asRecord = (value: unknown): JsonRecord => value && typeof value === 'object' ? value as JsonRecord : {};
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const number = (value: unknown): number => typeof value === 'number' ? value : Number(value) || 0;
const nullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const text = (value: unknown): string => typeof value === 'string' ? value : '';
const booleanish = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return ['1', 'true', 'yes', 'dofollow'].includes(value.trim().toLowerCase());
  return false;
};

const DATAFORSEO_MAX_NETWORK_ATTEMPTS = 3;

const statusFromMessage = (message: string): number | null => {
  const match = message.match(/\bHTTP\s+(\d{3})\b/i);
  return match ? Number(match[1]) : null;
};

// A 429 can be a short-lived transport throttle or a hard account limit. Only
// the latter must fail closed without retrying a paid request.
const providerQuotaMessage = (message: string): boolean => /quota|rate\s*limit|insufficient funds|balance|billing|account limit/i.test(message);

const asRequestError = (error: unknown): DataForSeoRequestError => {
  if (error instanceof DataForSeoRequestError) return error;
  const message = error instanceof Error ? error.message : String(error);
  const status = statusFromMessage(message);
  const quotaExceeded = providerQuotaMessage(message);
  // Native IPC errors carry the provider's HTTP status in their message. A
  // 429 caused by account quota/balance must fail closed just like the browser
  // transport path; retrying it would repeat a paid request without changing
  // the account state. Only an unqualified transport throttle is retryable.
  return new DataForSeoRequestError(message, status, status === 429 && !quotaExceeded, quotaExceeded);
};

const retryDelayMs = (error: DataForSeoRequestError, attempt: number): number => {
  if (error.retryAfterSeconds !== null) return Math.max(0, Math.min(error.retryAfterSeconds * 1000, 10_000));
  return Math.min(2_000, 250 * 2 ** attempt);
};

const wait = (milliseconds: number): Promise<void> => new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
const nullableIntent = (value: unknown): SearchIntent | null => typeof value === 'string' && value.trim() ? intent(value) : null;

export const normalizeDataForSeoDomain = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(i18n.t('runtimeErrors.dataforseo.domainRequired'));
  const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error(i18n.t('runtimeErrors.dataforseo.domainCredentials'));
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  if (!hostname || hostname === 'localhost' || !hostname.includes('.')) throw new Error(i18n.t('runtimeErrors.dataforseo.domainInvalid'));
  return hostname;
};

const legacyMarketCodes: Record<string, string> = {
  'united states': 'US',
  poland: 'PL',
  'united kingdom': 'GB',
  uk: 'GB',
  germany: 'DE',
  france: 'FR',
  spain: 'ES',
  italy: 'IT',
  canada: 'CA',
  australia: 'AU',
};

export const dataForSeoMarket = (country: string): DataForSeoMarket => {
  return requireDataForSeoMarket(country);
};

/** Resolve a provider market without silently changing a user's selection. */
export const resolveDataForSeoMarket = (country: string): DataForSeoMarket | null => {
  const normalized = country.trim().toUpperCase();
  const numeric = Number(normalized);
  if (Number.isInteger(numeric)) {
    return DATAFORSEO_MARKETS.find((market) => market.locationCode === numeric) || null;
  }
  const code = legacyMarketCodes[country.trim().toLowerCase()] || normalized;
  return DATAFORSEO_MARKETS.find((market) => market.code === code) || null;
};

export const requireDataForSeoMarket = (country: string): DataForSeoMarket => {
  const market = resolveDataForSeoMarket(country);
  if (!market) throw new Error(i18n.t('runtimeErrors.dataforseo.marketRequired'));
  return market;
};

export const dataForSeoLocation = (country: string): number => dataForSeoMarket(country).locationCode;

export const dataForSeoMarketByLocation = (locationCode: number): DataForSeoMarket => dataForSeoMarket(String(locationCode));

const displayLocale = (): string => (i18n.language || 'en').replace('_', '-');

/** Locale-aware labels with catalogue values as a deterministic fallback. */
export const dataForSeoMarketLabel = (market: DataForSeoMarket): string => {
  try {
    const displayNames = new Intl.DisplayNames([displayLocale()], { type: 'region' });
    return displayNames.of(market.countryIsoCode) || market.label;
  } catch {
    return market.label;
  }
};

export const dataForSeoLanguageLabel = (language: { code: string; label?: string }): string => {
  try {
    const displayNames = new Intl.DisplayNames([displayLocale()], { type: 'language' });
    return displayNames.of(language.code) || language.label || language.code;
  } catch {
    return language.label || language.code;
  }
};

export const dataForSeoLanguage = (country: string, language?: string): string => {
  const market = dataForSeoMarket(country);
  const normalized = language?.trim().toLowerCase();
  const selected = market.languages.find((item) => item.code.toLowerCase() === normalized);
  return selected?.code || market.languages[0]?.code || 'en';
};

const intent = (value: unknown): SearchIntent => {
  const normalized = text(value).toLowerCase();
  if (normalized.includes('transaction')) return 'Transactional';
  if (normalized.includes('commercial')) return 'Commercial';
  if (normalized.includes('informational')) return 'Informational';
  return 'Navigational';
};

export class DataForSEOClient {
  constructor(private readonly login: string, private readonly password: string, private readonly baseUrl = 'https://api.dataforseo.com') {}

  private auth(): string {
    return `Basic ${btoa(`${this.login}:${this.password}`)}`;
  }

  private projectId(): string {
    const projectId = activeProjectForTaskLog();
    if (!projectId) throw new Error(i18n.t('runtimeErrors.dataforseo.projectRequired'));
    return projectId;
  }

  private async request(path: string, payload?: JsonRecord[], projectIdOverride?: string | null): Promise<JsonRecord> {
    // Browser preview can still exercise live requests without a project; the
    // native transport is the boundary that requires project-scoped keychain
    // credentials. Task history remains best-effort in the browser fallback.
    const projectId = projectIdOverride !== undefined
      ? projectIdOverride
      : (isTauriEnvironment() ? this.projectId() : activeProjectForTaskLog());
    let lastError: DataForSeoRequestError | null = null;

    for (let attempt = 0; attempt < DATAFORSEO_MAX_NETWORK_ATTEMPTS; attempt += 1) {
      try {
        if (isTauriEnvironment()) {
          return await invokeTauriCommand<JsonRecord>('dataforseo_request', { projectId, path, payload: payload || null });
        }
        const response = await fetch(`${this.baseUrl}${path}`, {
          method: payload ? 'POST' : 'GET',
          headers: { Authorization: this.auth(), ...(payload ? { 'Content-Type': 'application/json' } : {}) },
          ...(payload ? { body: JSON.stringify(payload) } : {}),
        });
        if (!response.ok) {
          const body = asRecord(await response.json().catch(() => ({})));
          const providerMessage = text(body.status_message) || text(body.message) || i18n.t('runtimeErrors.dataforseo.httpStatus', { status: response.status });
          const status = response.status;
          // Live endpoints are POSTs and can be billable. A 5xx may arrive
          // after the provider accepted the task, so retrying it could create
          // duplicate paid work. Only an explicit 429 is safe to retry.
          const retryable = status === 429;
          const quotaExceeded = status === 429 && providerQuotaMessage(providerMessage);
          const retryAfterHeader = response.headers.get('Retry-After');
          const retryAfterSeconds = retryAfterHeader && Number.isFinite(Number(retryAfterHeader)) ? Number(retryAfterHeader) : null;
          throw new DataForSeoRequestError(
            quotaExceeded
              ? `DataForSEO quota or rate limit exceeded: ${providerMessage}`
              : i18n.t('runtimeErrors.dataforseo.httpError', { status, message: providerMessage }),
            status,
            retryable && !quotaExceeded,
            quotaExceeded,
            retryAfterSeconds,
          );
        }
        return asRecord(await response.json());
      } catch (error) {
        lastError = asRequestError(error);
        if (!lastError.retryable || attempt === DATAFORSEO_MAX_NETWORK_ATTEMPTS - 1) {
          appendDataForSeoTask({
            endpoint: path,
            taskId: null,
            statusCode: lastError.status,
            statusMessage: lastError.message,
            cost: null,
            timeSeconds: null,
            resultCount: null,
            requestedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          }, projectId);
          throw lastError;
        }
        await wait(retryDelayMs(lastError, attempt));
      }
    }

    throw lastError || new DataForSeoRequestError(i18n.t('runtimeErrors.dataforseo.requestFailed'));
  }

  private async post(path: string, payload: JsonRecord[], allowPartialStatusCodes: number[] = []): Promise<JsonRecord[]> {
    const requestedAt = new Date().toISOString();
    const projectId = isTauriEnvironment() ? this.projectId() : activeProjectForTaskLog();
    const body = await this.request(path, payload, projectId);
    const tasks = asArray(body.tasks);
    if (tasks.length === 0) {
      appendDataForSeoTask({
        endpoint: path,
        taskId: null,
        statusCode: null,
        statusMessage: i18n.t('runtimeErrors.dataforseo.noTaskResponse'),
        cost: null,
        timeSeconds: null,
        resultCount: null,
        requestedAt,
        completedAt: new Date().toISOString(),
      }, projectId);
      throw new Error(i18n.t('runtimeErrors.dataforseo.noTaskResponse'));
    }
    const task = asRecord(tasks[0]);
    const taskCode = nullableNumber(task.status_code);
    const result = asArray(task.result);
    appendDataForSeoTask({
      endpoint: path,
      taskId: text(task.id) || null,
      statusCode: taskCode,
      statusMessage: text(task.status_message) || null,
      cost: nullableNumber(task.cost),
      timeSeconds: nullableNumber(task.time),
      resultCount: nullableNumber(task.result_count) ?? (result.length || null),
      requestedAt,
      completedAt: new Date().toISOString(),
    }, projectId);
    if (taskCode && taskCode !== 20000 && !allowPartialStatusCodes.includes(taskCode)) throw new Error(text(task.status_message) || i18n.t('runtimeErrors.dataforseo.taskFailed', { code: taskCode }));
    return result.map(asRecord);
  }

  async verifyCredentials(): Promise<void> {
    const requestedAt = new Date().toISOString();
    const projectId = isTauriEnvironment() ? this.projectId() : activeProjectForTaskLog();
    const body = await this.request('/v3/appendix/user_data', undefined, projectId);
    const statusCode = nullableNumber(body.status_code);
    appendDataForSeoTask({
      endpoint: '/v3/appendix/user_data',
      taskId: null,
      statusCode,
      statusMessage: text(body.status_message) || null,
      cost: nullableNumber(body.cost),
      timeSeconds: nullableNumber(body.time),
      resultCount: null,
      requestedAt,
      completedAt: new Date().toISOString(),
    }, projectId);
    if (statusCode && statusCode !== 20000) {
      throw new Error(text(body.status_message) || i18n.t('runtimeErrors.dataforseo.requestFailedStatus', { status: statusCode }));
    }
  }

  async getBacklinksSummary(target: string): Promise<DataForSEOBacklinkSummary | null> {
    const item = (await this.post('/v3/backlinks/summary/live', [{ target, internal_list_limit: 1000 }]))[0];
    if (!item) return null;
    return {
      target,
      total_backlinks: number(item.backlinks),
      referring_domains: number(item.referring_domains),
      referring_main_domains: number(item.referring_main_domains),
      rank: number(item.rank),
      dofollow_backlinks: item.referring_links_attributes && typeof item.referring_links_attributes === 'object'
        ? Math.max(0, number(item.backlinks) - number(asRecord(item.referring_links_attributes).nofollow))
        : nullableNumber(item.dofollow),
      broken_backlinks: number(item.broken_backlinks),
    };
  }

  async getSerpCompetitors(keyword: string, locationCode = 2840, languageCode = 'en', allowPartial = false): Promise<DataForSEOSerpItem[]> {
    const result = (await this.post('/v3/serp/google/organic/live/regular', [{ keyword, location_code: locationCode, language_code: languageCode, depth: 100 }], allowPartial ? [40106] : []))[0];
    return asArray(result?.items).map(asRecord).filter((item) => text(item.type) === 'organic').map((item) => ({
      type: text(item.type), rank_group: number(item.rank_group), rank_absolute: number(item.rank_absolute),
      domain: text(item.domain), title: text(item.title), description: text(item.description), url: text(item.url),
    }));
  }

  /** Related live suggestions from Google Ads keyword data, never synthetic expansions. */
  async getKeywordIdeas(keyword: string, locationCode: number, languageCode = 'en'): Promise<KeywordIdea[]> {
    const result = await this.post('/v3/keywords_data/google_ads/keywords_for_keywords/live', [{ keywords: [keyword], location_code: locationCode, language_code: languageCode }]);
    // Google Ads returns keyword rows directly in task.result, while other
    // DataForSEO endpoints wrap rows in an `items` property. Support both
    // documented envelopes and fail loudly for a non-empty unknown shape.
    const rows = result.flatMap((item) => {
      const record = asRecord(item);
      return Array.isArray(record.items) ? asArray(record.items).map(asRecord) : [record];
    });
    if (result.length > 0 && !rows.some((row) => text(row.keyword))) {
      const hasKnownEmptyEnvelope = result.every((item) => Array.isArray(asRecord(item).items));
      if (!hasKnownEmptyEnvelope) throw new Error(i18n.t('runtimeErrors.dataforseo.keywordShape'));
    }
    return rows.map((item) => {
      const searchIntent = asRecord(item.search_intent_info);
      const monthlySearches = asArray(item.monthly_searches).map((month) => {
        const value = asRecord(month);
        return {
          year: nullableNumber(value.year),
          month: nullableNumber(value.month),
          searchVolume: nullableNumber(value.search_volume),
        };
      });
      return {
        keyword: text(item.keyword), search_volume: number(item.search_volume), cpc: number(item.cpc),
        competition: number(item.competition_index) / 100, difficulty: number(item.competition_index),
        intent: intent(searchIntent.main_intent), trend: monthlySearches.map((month) => month.searchVolume ?? 0),
        sourceMetrics: {
          searchVolume: nullableNumber(item.search_volume),
          cpc: nullableNumber(item.cpc),
          competitionIndex: nullableNumber(item.competition_index),
          intent: text(searchIntent.main_intent) || null,
          monthlySearches,
        },
      };
    }).filter((item) => item.keyword);
  }

  async getBacklinkAnchorsPage(target: string, offset = 0, limit = BACKLINK_PAGE_SIZE, totalBacklinks?: number): Promise<DataForSeoPage<BacklinkAnchorDistribution>> {
    const result = (await this.post('/v3/backlinks/anchors/live', [{ target, limit, offset }]))[0];
    const anchorTotal = totalBacklinks ?? null;
    const items = asArray(result?.items).map(asRecord).map((item): BacklinkAnchorDistribution => ({
      anchor: text(item.anchor),
      count: number(item.backlinks),
      percentage: anchorTotal !== null && anchorTotal > 0 ? Number(((number(item.backlinks) / anchorTotal) * 100).toFixed(1)) : null,
    }));
    return { items, totalCount: nullableNumber(result?.total_count), referringSubnets: nullableNumber(result?.referring_subnets) };
  }

  async getBacklinksPage(target: string, offset = 0, limit = BACKLINK_PAGE_SIZE): Promise<DataForSeoPage<BacklinkItem>> {
    const result = (await this.post('/v3/backlinks/backlinks/live', [{ target, limit, offset }]))[0];
    const items = asArray(result?.items).map(asRecord).map((item): BacklinkItem => ({
      source_title: text(item.title), source_url: text(item.url_from), target_url: text(item.url_to), anchor_text: text(item.anchor),
      is_dofollow: booleanish(item.dofollow), domain_rank: number(item.rank), first_seen: text(item.first_seen),
    }));
    return { items, totalCount: nullableNumber(result?.total_count) };
  }

  async getBacklinkGapPage(target: string, competitors: string[], offset = 0, limit = BACKLINK_PAGE_SIZE, includeSubdomains = true): Promise<DataForSeoPage<BacklinkGapOpportunity>> {
    const normalizedTarget = normalizeDataForSeoDomain(target);
    const normalizedCompetitors = Array.from(new Set(competitors.map(normalizeDataForSeoDomain).filter((domain) => domain !== normalizedTarget)));
    if (!normalizedCompetitors.length) throw new Error(i18n.t('runtimeErrors.dataforseo.competitorRequired'));
    if (normalizedCompetitors.length > 19) throw new Error(i18n.t('runtimeErrors.dataforseo.competitorLimit'));
    const targetsById = Object.fromEntries(normalizedCompetitors.map((domain, index) => [String(index + 1), domain]));
    const safeOffset = Math.max(0, Math.trunc(offset));
    const safeLimit = Math.min(1000, Math.max(1, Math.trunc(limit) || BACKLINK_PAGE_SIZE));
    const result = (await this.post('/v3/backlinks/domain_intersection/live', [{
      targets: targetsById,
      exclude_targets: [normalizedTarget],
      intersection_mode: 'partial',
      include_subdomains: includeSubdomains,
      limit: safeLimit,
      offset: safeOffset,
    }]))[0];
    const rows = asArray(result?.items).map(asRecord);
    const opportunities = rows.flatMap((row): BacklinkGapOpportunity[] => {
      const byTarget = asRecord(row.domain_intersection);
      const competitorData = normalizedCompetitors.flatMap((domain, index) => {
        const data = asRecord(byTarget[String(index + 1)]);
        return number(data.backlinks) > 0 ? [{ domain, referringDomain: text(data.target), backlinks: number(data.backlinks), rank: nullableNumber(data.rank), spamScore: nullableNumber(data.backlinks_spam_score) }] : [];
      });
      const sourceDomain = competitorData.map((item) => item.referringDomain).find(Boolean) || '';
      if (!sourceDomain || competitorData.length === 0) return [];
      return [{
        referring_domain: sourceDomain.toLowerCase().replace(/^www\./, ''),
        target_backlinks: 0,
        competitor_backlinks: competitorData.map(({ domain, backlinks, rank }) => ({ domain, backlinks, rank })),
        max_competitor_spam_score: competitorData.reduce<number | null>((max, item) => item.spamScore === null ? max : Math.max(max ?? item.spamScore, item.spamScore), null),
      }];
    });
    return { items: opportunities, totalCount: nullableNumber(result?.total_count), rawCount: rows.length };
  }

  async getBacklinkProfile(target: string): Promise<BacklinkProfileData | null> {
    const summary = await this.getBacklinksSummary(target);
    if (!summary) return null;
    const total = summary.total_backlinks;
    const [anchorsPage, backlinksPage] = await Promise.all([
      this.getBacklinkAnchorsPage(target, 0, BACKLINK_PAGE_SIZE, total),
      this.getBacklinksPage(target),
    ]);
    return {
      domain: target, total_backlinks: summary.total_backlinks, referring_domains: summary.referring_domains,
      referring_subnets: anchorsPage.referringSubnets ?? null, domain_rank: summary.rank,
      dofollow_ratio: total > 0 && summary.dofollow_backlinks !== null ? Number(((summary.dofollow_backlinks / total) * 100).toFixed(1)) : null,
      total_anchor_rows: anchorsPage.totalCount,
      total_backlink_rows: backlinksPage.totalCount,
      anchors: anchorsPage.items,
      backlinks: backlinksPage.items,
    };
  }

  async getDomainOverview(target: string, locationCode: number, languageCode = 'en'): Promise<DomainOverviewData | null> {
    const [overviewResult, rankedResult, pagesResult, competitorsResult, backlinks] = await Promise.all([
      this.post('/v3/dataforseo_labs/google/domain_rank_overview/live', [{ target, location_code: locationCode, language_code: languageCode }]),
      this.post('/v3/dataforseo_labs/google/ranked_keywords/live', [{ target, location_code: locationCode, language_code: languageCode, limit: 10 }]),
      this.post('/v3/dataforseo_labs/google/relevant_pages/live', [{ target, location_code: locationCode, language_code: languageCode, limit: 10 }]),
      this.post('/v3/dataforseo_labs/google/competitors_domain/live', [{ target, location_code: locationCode, language_code: languageCode, limit: 10 }]),
      this.getBacklinksSummary(target),
    ]);
    const overviewItem = asArray(overviewResult[0]?.items).map(asRecord)[0];
    if (!overviewItem) return null;
    const organicMetrics = asRecord(asRecord(overviewItem.metrics).organic);
    const rawOrganicTraffic = nullableNumber(organicMetrics.etv);
    const organicTraffic = rawOrganicTraffic === null ? null : Math.round(rawOrganicTraffic);
    const ranked = asArray(rankedResult[0]?.items).map(asRecord);
    const pages = asArray(pagesResult[0]?.items).map(asRecord);
    const competitors = asArray(competitorsResult[0]?.items).map(asRecord);
    return {
      domain: target, organic_traffic: organicTraffic, organic_keywords: nullableNumber(organicMetrics.count),
      domain_rank: backlinks ? backlinks.rank : null, referring_domains: backlinks ? backlinks.referring_domains : null,
      total_backlinks: backlinks ? backlinks.total_backlinks : null,
      dofollow_ratio: backlinks && backlinks.total_backlinks > 0 && backlinks.dofollow_backlinks !== null
        ? Number(((backlinks.dofollow_backlinks / backlinks.total_backlinks) * 100).toFixed(1))
        : null,
      top_keywords: ranked.map((row) => {
        const keywordData = asRecord(row.keyword_data); const serp = asRecord(row.ranked_serp_element); const serpItem = asRecord(serp.serp_item); const keywordInfo = asRecord(keywordData.keyword_info);
        const estimatedTraffic = nullableNumber(serpItem.etv);
        return {
          keyword: text(keywordData.keyword), position: nullableNumber(serpItem.rank_absolute),
          search_volume: nullableNumber(keywordInfo.search_volume),
          traffic_share: estimatedTraffic !== null && rawOrganicTraffic !== null && rawOrganicTraffic > 0 ? Number(((estimatedTraffic / rawOrganicTraffic) * 100).toFixed(2)) : null,
          intent: nullableIntent(asRecord(keywordData.search_intent_info).main_intent),
        };
      }).filter((row) => row.keyword && (row.position === null || row.position <= 100)),
      top_pages: pages.map((row) => {
        const pageOrganic = asRecord(asRecord(row.metrics).organic);
        const pageTraffic = nullableNumber(pageOrganic.etv);
        return {
          url: text(row.page_address),
          traffic_percentage: pageTraffic !== null && rawOrganicTraffic !== null && rawOrganicTraffic > 0 ? Number(((pageTraffic / rawOrganicTraffic) * 100).toFixed(2)) : null,
          keywords_count: nullableNumber(pageOrganic.count),
        };
      }).filter((page) => page.url),
      competitors: competitors.map((row) => ({ domain: text(row.domain).toLowerCase().replace(/^www\./, ''), common_keywords: nullableNumber(row.intersections), average_position: nullableNumber(row.avg_position) })).filter((row) => row.domain && row.domain !== target.toLowerCase().replace(/^www\./, '')),
    };
  }
}
