import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataForSEOCore } from '@/services/dataforseo/dataforseoCore';

const m = vi.hoisted(() => ({ invoke: vi.fn(), project: 'proj' as string | null, readAccount: vi.fn(), append: vi.fn() }));
vi.mock('@/services/tauri', () => ({ isTauriEnvironment: () => true, invokeTauriCommand: m.invoke }));
vi.mock('@/services/dataforseo/dataforseoTaskLog', () => ({ activeProjectForTaskLog: () => m.project, appendDataForSeoTask: m.append }));
vi.mock('@/services/dataforseo/dataforseoBudgetGuard', () => ({ reserveBudget: () => () => undefined, nativeBudget: () => null }));
vi.mock('@/services/dataforseo/dataforseoBudget', () => ({ ACCOUNT_ENDPOINT: '/v3/appendix/user_data', recordCost: vi.fn() }));
vi.mock('@/services/dataforseo/dataforseoAccount', () => ({
  deductFromAccount: vi.fn(), parseUserData: () => null, readAccount: m.readAccount, writeAccount: vi.fn(),
}));

describe('DataForSEOCore in the native environment', () => {
  const core = new DataForSEOCore('user', 'pw');
  beforeEach(() => {
    vi.clearAllMocks();
    m.project = 'proj';
    m.invoke.mockResolvedValue({ status_code: 20000, cost: 0 });
  });

  it('resolves the active project for getAccount and reads the stored account', async () => {
    m.readAccount.mockReturnValue({ balance: 3 });
    expect(await core.getAccount()).toEqual({ balance: 3 });
    expect(m.readAccount).toHaveBeenCalledWith('proj');
  });

  it('requires an active project for getAccount and verifyCredentials', async () => {
    m.project = null;
    await expect(core.getAccount()).rejects.toThrow();
    await expect(core.verifyCredentials()).rejects.toThrow();
    expect(m.invoke).not.toHaveBeenCalled();
  });

  it('verifyCredentials logs the native call under the active project', async () => {
    await core.verifyCredentials();
    expect(m.invoke).toHaveBeenCalledWith('dataforseo_request', { projectId: 'proj', path: '/v3/appendix/user_data', payload: null, budget: null });
    expect(m.append).toHaveBeenCalledWith(expect.objectContaining({ endpoint: '/v3/appendix/user_data', statusCode: 20000 }), 'proj');
  });
});
