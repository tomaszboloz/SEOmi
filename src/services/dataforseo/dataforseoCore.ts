import i18n from '@/i18n';
import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri';
import { JsonRecord, DataForSeoRequestError } from './dataforseoTypes';
import { asRecord, asArray, asRequestError, nullableNumber, text, wait, retryDelayMs, providerQuotaMessage } from './dataforseoHelpers';
import { activeProjectForTaskLog, appendDataForSeoTask } from './dataforseoTaskLog';
import { ACCOUNT_ENDPOINT, recordCost } from './dataforseoBudget';
import { reserveBudget } from './dataforseoBudgetGuard';
import { deductFromAccount, parseUserData, readAccount, writeAccount, type DataForSeoAccount } from './dataforseoAccount';

const DATAFORSEO_MAX_NETWORK_ATTEMPTS = 3;

export class DataForSEOCore {
  constructor(private readonly login: string, private readonly password: string, private readonly baseUrl = 'https://api.dataforseo.com') {}

  private auth(): string {
    return `Basic ${btoa(`${this.login}:${this.password}`)}`;
  }

  private projectId(): string {
    const projectId = activeProjectForTaskLog();
    if (!projectId) throw new Error(i18n.t('runtimeErrors.dataforseo.projectRequired'));
    return projectId;
  }

  async request(path: string, payload?: JsonRecord[], projectIdOverride?: string | null): Promise<JsonRecord> {
    const projectId = projectIdOverride !== undefined
      ? projectIdOverride
      : (isTauriEnvironment() ? this.projectId() : activeProjectForTaskLog());
    // Throws before any network traffic when the monthly cap is reached.
    const release = reserveBudget(projectId, path);
    try {
      const body = await this.send(path, payload, projectId);
      // The top-level cost covers every task in the request.
      if (projectId) {
        const cost = nullableNumber(body.cost) ?? 0;
        recordCost(projectId, path, cost);
        deductFromAccount(projectId, cost);
        if (path === ACCOUNT_ENDPOINT) {
          const account = parseUserData(body);
          if (account) writeAccount(projectId, account);
        }
      }
      return body;
    } finally {
      release();
    }
  }

  private async send(path: string, payload: JsonRecord[] | undefined, projectId: string | null): Promise<JsonRecord> {
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
          const retryable = status === 429;
          const quotaExceeded = status === 429 && providerQuotaMessage(providerMessage);
          const retryAfterHeader = response.headers.get('Retry-After');
          const retryAfterSeconds = retryAfterHeader && Number.isFinite(Number(retryAfterHeader)) ? Number(retryAfterHeader) : null;
          throw new DataForSeoRequestError(
            quotaExceeded ? `DataForSEO quota or rate limit exceeded: ${providerMessage}` : i18n.t('runtimeErrors.dataforseo.httpError', { status, message: providerMessage }),
            status, retryable && !quotaExceeded, quotaExceeded, retryAfterSeconds,
          );
        }
        return asRecord(await response.json());
      } catch (error) {
        lastError = asRequestError(error);
        if (!lastError.retryable || attempt === DATAFORSEO_MAX_NETWORK_ATTEMPTS - 1) {
          appendDataForSeoTask({
            endpoint: path, taskId: null, statusCode: lastError.status, statusMessage: lastError.message,
            cost: null, timeSeconds: null, resultCount: null,
            requestedAt: new Date().toISOString(), completedAt: new Date().toISOString(),
          }, projectId);
          throw lastError;
        }
        await wait(retryDelayMs(lastError, attempt));
      }
    }
    throw lastError || new DataForSeoRequestError(i18n.t('runtimeErrors.dataforseo.requestFailed'));
  }

  async post(path: string, payload: JsonRecord[], allowPartialStatusCodes: number[] = []): Promise<JsonRecord[]> {
    const requestedAt = new Date().toISOString();
    const projectId = isTauriEnvironment() ? this.projectId() : activeProjectForTaskLog();
    const body = await this.request(path, payload, projectId);
    const tasks = asArray(body.tasks);
    if (tasks.length === 0) {
      appendDataForSeoTask({
        endpoint: path, taskId: null, statusCode: null, statusMessage: i18n.t('runtimeErrors.dataforseo.noTaskResponse'),
        cost: null, timeSeconds: null, resultCount: null, requestedAt, completedAt: new Date().toISOString(),
      }, projectId);
      throw new Error(i18n.t('runtimeErrors.dataforseo.noTaskResponse'));
    }
    const task = asRecord(tasks[0]);
    const taskCode = nullableNumber(task.status_code);
    const result = asArray(task.result);
    appendDataForSeoTask({
      endpoint: path, taskId: text(task.id) || null, statusCode: taskCode, statusMessage: text(task.status_message) || null,
      cost: nullableNumber(task.cost), timeSeconds: nullableNumber(task.time), resultCount: nullableNumber(task.result_count) ?? (result.length || null),
      requestedAt, completedAt: new Date().toISOString(),
    }, projectId);
    if (taskCode && taskCode !== 20000 && !allowPartialStatusCodes.includes(taskCode)) throw new Error(text(task.status_message) || i18n.t('runtimeErrors.dataforseo.taskFailed', { code: taskCode }));
    return result.map(asRecord);
  }

  /** Fetches the account balance (free endpoint) and stores it for the project. */
  async getAccount(): Promise<DataForSeoAccount | null> {
    const projectId = isTauriEnvironment() ? this.projectId() : activeProjectForTaskLog();
    await this.verifyCredentials();
    return projectId ? readAccount(projectId) : null;
  }

  async verifyCredentials(): Promise<void> {
    const requestedAt = new Date().toISOString();
    const projectId = isTauriEnvironment() ? this.projectId() : activeProjectForTaskLog();
    const body = await this.request('/v3/appendix/user_data', undefined, projectId);
    const statusCode = nullableNumber(body.status_code);
    appendDataForSeoTask({
      endpoint: '/v3/appendix/user_data', taskId: null, statusCode, statusMessage: text(body.status_message) || null,
      cost: nullableNumber(body.cost), timeSeconds: nullableNumber(body.time), resultCount: null,
      requestedAt, completedAt: new Date().toISOString(),
    }, projectId);
    if (statusCode && statusCode !== 20000) {
      throw new Error(text(body.status_message) || i18n.t('runtimeErrors.dataforseo.requestFailedStatus', { status: statusCode }));
    }
  }
}
