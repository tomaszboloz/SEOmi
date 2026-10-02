import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '../src/stores/authStore';
import { AIService } from '../src/services/ai';

describe('useAuthStore (Direct AI Subscriptions - Zero Credits)', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      activeProjectId: null,
      provider: 'openai',
      model: 'gpt-4o',
      connectionMethod: { openai: 'api_key', claude: 'api_key', gemini: 'api_key' },
      connectionStatus: { openai: 'unconfigured', claude: 'unconfigured', gemini: 'unconfigured' },
      statusMessages: { openai: '', claude: '', gemini: '' },
    });
  });

  it('should initialize with direct BYOK subscription mode', () => {
    const store = useAuthStore.getState();
    expect(store.subscription.tier).toBe('direct');
    expect(store.provider).toBe('openai');
  });

  it('should switch AI provider and update smart default model', () => {
    const store = useAuthStore.getState();
    store.setProvider('claude');
    expect(useAuthStore.getState().provider).toBe('claude');
    expect(useAuthStore.getState().model).toBe('claude-opus-5');

    store.setProvider('gemini');
    expect(useAuthStore.getState().provider).toBe('gemini');
    expect(useAuthStore.getState().model).toBe('gemini-2.0-flash');
  });

  it('keeps the selected connection method per provider without artificial credits', () => {
    const store = useAuthStore.getState();
    expect(store.isProviderConnected('openai')).toBe(false);
    store.setConnectionMethod('openai', 'local_cli');
    store.setConnectionMethod('claude', 'api_key');
    expect(useAuthStore.getState().connectionMethod).toMatchObject({ openai: 'local_cli', claude: 'api_key' });
    expect(useAuthStore.getState().subscription).toEqual({ tier: 'direct' });
  });

  it('treats a detected, signed-in local CLI as connected after a restart or project switch', () => {
    const detected = { provider: 'claude' as const, command: 'claude', available: true, detail: '2.1.287 (Claude Code)' };
    useAuthStore.setState({ cliStatus: { openai: null, claude: detected, gemini: { provider: 'gemini', command: 'gemini', available: true, detail: '1.0' } } });
    const store = useAuthStore.getState();
    store.setProvider('claude');
    store.setConnectionMethod('claude', 'local_cli');
    store.setConnectionMethod('gemini', 'local_cli');
    expect(useAuthStore.getState().connectionStatus.claude).toBe('connected');
    // Gemini has no sign-in check, so detection alone proves nothing.
    expect(useAuthStore.getState().connectionStatus.gemini).toBe('unconfigured');

    store.hydrateProject('project-cli');
    expect(useAuthStore.getState().connectionStatus).toMatchObject({ claude: 'connected', openai: 'unconfigured', gemini: 'unconfigured' });
    expect(useAuthStore.getState().statusMessages.claude).toBe('2.1.287 (Claude Code)');
    expect(useAuthStore.getState().isProviderConnected('claude')).toBe(true);

    // The same CLI behind an API credential is not a connection.
    useAuthStore.getState().setConnectionMethod('claude', 'api_key');
    expect(useAuthStore.getState().connectionStatus.claude).toBe('unconfigured');
    useAuthStore.setState({ cliStatus: { openai: null, claude: null, gemini: null } });
  });

  it('isolates AI preferences by project and migrates legacy preferences only once', () => {
    const store = useAuthStore.getState();
    store.setProvider('claude');
    store.setConnectionMethod('claude', 'local_cli');

    store.hydrateProject('project-a');
    expect(useAuthStore.getState()).toMatchObject({
      activeProjectId: 'project-a',
      provider: 'claude',
      connectionMethod: { claude: 'local_cli' },
    });

    store.hydrateProject('project-b');
    expect(useAuthStore.getState()).toMatchObject({
      activeProjectId: 'project-b',
      provider: 'openai',
      connectionMethod: { claude: 'api_key' },
    });

    useAuthStore.getState().setProvider('gemini');
    useAuthStore.getState().hydrateProject('project-a');
    expect(useAuthStore.getState()).toMatchObject({
      activeProjectId: 'project-a',
      provider: 'claude',
      connectionMethod: { claude: 'local_cli' },
    });
  });

  it('should reject connection test when API key is empty', async () => {
    const store = useAuthStore.getState();
    const res = await store.testProviderConnection('gemini');
    expect(res.success).toBe(false);
    expect(res.message).toContain('API key is required');
  });

  it('settles a native connection failure as an error instead of leaving testing state', async () => {
    const testConnection = vi
      .spyOn(AIService, 'testConnection')
      .mockRejectedValueOnce(new Error('native transport failed'));

    useAuthStore.setState({
      apiKeys: { openai: 'test-key', claude: '', gemini: '' },
      connectionMethod: { openai: 'api_key', claude: 'api_key', gemini: 'api_key' },
    });

    const response = await useAuthStore.getState().testProviderConnection('openai');

    expect(response.success).toBe(false);
    expect(response.message).toContain('native transport failed');
    expect(useAuthStore.getState().connectionStatus.openai).toBe('error');
    expect(useAuthStore.getState().statusMessages.openai).toContain('native transport failed');
    testConnection.mockRestore();
  });

  it('keeps the newest provider connection result when checks finish out of order', async () => {
    let releaseOld!: (value: { success: boolean; message: string }) => void;
    const testConnection = vi.spyOn(AIService, 'testConnection')
      .mockImplementationOnce(() => new Promise((resolve) => { releaseOld = resolve; }))
      .mockResolvedValueOnce({ success: true, message: 'fresh connection' });
    useAuthStore.setState({
      apiKeys: { openai: 'test-key', claude: '', gemini: '' },
      connectionMethod: { openai: 'api_key', claude: 'api_key', gemini: 'api_key' },
      connectionStatus: { openai: 'unconfigured', claude: 'unconfigured', gemini: 'unconfigured' },
    });

    const oldCheck = useAuthStore.getState().testProviderConnection('openai');
    await Promise.resolve();
    const freshCheck = useAuthStore.getState().testProviderConnection('openai');
    await freshCheck;
    expect(useAuthStore.getState().connectionStatus.openai).toBe('connected');
    expect(useAuthStore.getState().statusMessages.openai).toBe('fresh connection');

    releaseOld({ success: false, message: 'stale failure' });
    await oldCheck;
    expect(useAuthStore.getState().connectionStatus.openai).toBe('connected');
    expect(useAuthStore.getState().statusMessages.openai).toBe('fresh connection');
    testConnection.mockRestore();
  });
});
