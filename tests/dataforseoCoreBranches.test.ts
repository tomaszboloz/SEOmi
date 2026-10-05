import { beforeEach, expect, it, vi } from 'vitest';
import { DataForSEOCore } from '@/services/dataforseo/dataforseoCore';
import { DataForSeoRequestError } from '@/services/dataforseo/dataforseoTypes';

const m = vi.hoisted(() => ({
  tauri: false, invoke: vi.fn(), project: 'proj' as string | null, release: vi.fn(), reserve: vi.fn(), record: vi.fn(), deduct: vi.fn(),
  writeAccount: vi.fn(), readAccount: vi.fn(), parseUser: vi.fn(), append: vi.fn(), wait: vi.fn(),
}));
vi.mock('@/services/tauri', () => ({ isTauriEnvironment: () => m.tauri, invokeTauriCommand: m.invoke }));
vi.mock('@/services/dataforseo/dataforseoTaskLog', () => ({ activeProjectForTaskLog: () => m.project, appendDataForSeoTask: m.append }));
vi.mock('@/services/dataforseo/dataforseoBudgetGuard', () => ({ reserveBudget: m.reserve }));
vi.mock('@/services/dataforseo/dataforseoBudget', () => ({ ACCOUNT_ENDPOINT: '/v3/appendix/user_data', recordCost: m.record }));
vi.mock('@/services/dataforseo/dataforseoAccount', () => ({ deductFromAccount: m.deduct, parseUserData: m.parseUser, readAccount: m.readAccount, writeAccount: m.writeAccount }));
vi.mock('@/services/dataforseo/dataforseoHelpers', async (orig) => ({ ...(await orig<object>()), wait: m.wait }));

const core = new DataForSEOCore('user', 'pw', 'https://api.test');
const res = (status: number, body: unknown, headers: Record<string, string> = {}) => ({ ok: status < 400, status, json: async () => body, headers: new Headers(headers) });
const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('fetch', fetchMock); m.tauri = false; m.project = 'proj';
  m.reserve.mockReturnValue(m.release); m.wait.mockResolvedValue(undefined); m.parseUser.mockReturnValue(null);
});

it('posts JSON with basic auth, records cost and releases the reservation', async () => {
  fetchMock.mockResolvedValue(res(200, { cost: 0.5, tasks: [] }));
  const body = await core.request('/v3/x', [{ a: 1 }]);
  expect(body.cost).toBe(0.5);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('https://api.test/v3/x');
  expect(init).toMatchObject({ method: 'POST', body: '[{"a":1}]' });
  expect(init.headers.Authorization).toBe(`Basic ${btoa('user:pw')}`);
  expect(m.record).toHaveBeenCalledWith('proj', '/v3/x', 0.5);
  expect(m.deduct).toHaveBeenCalledWith('proj', 0.5);
  expect(m.release).toHaveBeenCalledTimes(1);
});

it('uses GET without a payload, defaults cost to zero and skips accounting without project', async () => {
  fetchMock.mockResolvedValue(res(200, {}));
  await core.request('/v3/y');
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'GET' }); expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
  expect(m.record).toHaveBeenCalledWith('proj', '/v3/y', 0);
  m.record.mockClear();
  await core.request('/v3/y', undefined, null);
  expect(m.record).not.toHaveBeenCalled();
});

it('stores parsed account data only for the account endpoint', async () => {
  fetchMock.mockResolvedValue(res(200, { cost: 0 }));
  m.parseUser.mockReturnValue({ balance: 1 });
  await core.request('/v3/appendix/user_data');
  expect(m.writeAccount).toHaveBeenCalledWith('proj', { balance: 1 });
  m.writeAccount.mockClear(); m.parseUser.mockReturnValue(null);
  await core.request('/v3/appendix/user_data');
  await core.request('/v3/other');
  expect(m.writeAccount).not.toHaveBeenCalled();
});

it('goes through the native command in the desktop shell and requires a project', async () => {
  m.tauri = true; m.invoke.mockResolvedValue({ cost: 0 });
  await core.request('/v3/z', [{ q: 1 }]);
  expect(m.invoke).toHaveBeenCalledWith('dataforseo_request', { projectId: 'proj', path: '/v3/z', payload: [{ q: 1 }] });
  await core.request('/v3/z', undefined, 'other');
  expect(m.invoke).toHaveBeenLastCalledWith('dataforseo_request', { projectId: 'other', path: '/v3/z', payload: null });
  m.project = null;
  await expect(core.request('/v3/z')).rejects.toThrow();
  expect(m.release).toHaveBeenCalledTimes(2);
});

it('retries a throttled 429 honouring Retry-After and then succeeds', async () => {
  fetchMock.mockResolvedValueOnce(res(429, { status_message: 'slow down' }, { 'Retry-After': '2' })).mockResolvedValueOnce(res(200, {}));
  await core.request('/v3/r');
  expect(m.wait).toHaveBeenCalledWith(2000);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('gives up after three throttled attempts and logs the failure', async () => {
  fetchMock.mockResolvedValue(res(429, undefined, { 'Retry-After': 'abc' }));
  await expect(core.request('/v3/r')).rejects.toMatchObject({ status: 429, retryable: true, retryAfterSeconds: null });
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(m.wait).toHaveBeenCalledTimes(2);
  expect(m.append).toHaveBeenCalledWith(expect.objectContaining({ endpoint: '/v3/r', statusCode: 429 }), 'proj');
});

it('fails closed on quota 429 and surfaces non-retryable HTTP errors with provider text', async () => {
  fetchMock.mockResolvedValueOnce(res(429, { message: 'Insufficient funds' }));
  const quota = await core.request('/v3/q').catch((e) => e);
  expect(quota).toBeInstanceOf(DataForSeoRequestError);
  expect(quota).toMatchObject({ quotaExceeded: true, retryable: false });
  expect(quota.message).toContain('Insufficient funds');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fetchMock.mockResolvedValueOnce(res(500, { status_message: 'boom' }));
  await expect(core.request('/v3/q')).rejects.toMatchObject({ status: 500, retryable: false, quotaExceeded: false });
});

it('wraps transport exceptions and invalid error bodies', async () => {
  fetchMock.mockRejectedValueOnce(new Error('network down'));
  await expect(core.request('/v3/n')).rejects.toThrow('network down');
  fetchMock.mockResolvedValueOnce({ ok: false, status: 502, json: async () => { throw new Error('bad json'); }, headers: new Headers() });
  await expect(core.request('/v3/n')).rejects.toMatchObject({ status: 502 });
});

const task = (over: object = {}) => ({ tasks: [{ id: 't1', status_code: 20000, status_message: 'Ok.', cost: 0.1, time: '0.5 sec', result_count: 2, result: [{ a: 1 }, 'x'], ...over }] });
it('post returns task results and logs the task', async () => {
  fetchMock.mockResolvedValue(res(200, task()));
  const out = await core.post('/v3/p', [{}]);
  expect(out).toEqual([{ a: 1 }, {}]);
  expect(m.append).toHaveBeenCalledWith(expect.objectContaining({ endpoint: '/v3/p', taskId: 't1', statusCode: 20000, cost: 0.1, resultCount: 2 }), 'proj');
});

it('post falls back to result length, null ids and tolerates allowed partial codes', async () => {
  fetchMock.mockResolvedValueOnce(res(200, task({ id: undefined, status_message: undefined, result_count: undefined, result: [] })));
  await core.post('/v3/p', [{}]);
  expect(m.append).toHaveBeenLastCalledWith(expect.objectContaining({ taskId: null, statusMessage: null, resultCount: null }), 'proj');
  fetchMock.mockResolvedValueOnce(res(200, task({ status_code: 40501, result: [{ b: 1 }] })));
  expect(await core.post('/v3/p', [{}], [40501])).toEqual([{ b: 1 }]);
  m.tauri = true; m.invoke.mockResolvedValue(task());
  expect(await core.post('/v3/p', [{}])).toHaveLength(2);
});

it('post rejects when no task is returned or the task failed', async () => {
  fetchMock.mockResolvedValueOnce(res(200, {}));
  await expect(core.post('/v3/p', [{}])).rejects.toThrow();
  expect(m.append).toHaveBeenLastCalledWith(expect.objectContaining({ taskId: null, statusCode: null }), 'proj');
  fetchMock.mockResolvedValueOnce(res(200, task({ status_code: 40000, status_message: 'Bad field' })));
  await expect(core.post('/v3/p', [{}])).rejects.toThrow('Bad field');
  fetchMock.mockResolvedValueOnce(res(200, task({ status_code: 50000, status_message: '' })));
  await expect(core.post('/v3/p', [{}])).rejects.toThrow(/50000/);
});

it('verifies credentials and reads the stored account', async () => {
  fetchMock.mockResolvedValue(res(200, { status_code: 20000, cost: 0, time: '0.1' }));
  m.readAccount.mockReturnValue({ balance: 7 });
  expect(await core.getAccount()).toEqual({ balance: 7 });
  m.project = null;
  expect(await core.getAccount()).toBeNull();
  fetchMock.mockResolvedValue(res(200, { status_code: 40100, status_message: 'Auth failed' }));
  await expect(core.verifyCredentials()).rejects.toThrow('Auth failed');
  fetchMock.mockResolvedValue(res(200, { status_code: 40100 }));
  await expect(core.verifyCredentials()).rejects.toThrow(/40100/);
  fetchMock.mockResolvedValue(res(200, {}));
  await expect(core.verifyCredentials()).resolves.toBeUndefined();
});
