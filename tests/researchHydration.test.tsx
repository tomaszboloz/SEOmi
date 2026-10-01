import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useToolsStore } from '@/stores/toolsStore';
import { useProjectStore } from '@/stores/projectStore';
import { DomainOverview } from '@/components/Domain/DomainOverview';
import { BacklinkChecker } from '@/components/Domain/BacklinkChecker';

const projectId = 'validated-research';
const originalTools = useToolsStore.getState();
const originalProjects = useProjectStore.getState();
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('seomi_active_project_v1', projectId);
  useProjectStore.setState({ activeProjectId: projectId, projects: [{
    id: projectId, name: 'Research', rootUrl: 'https://example.com',
    createdAt: '2026-10-01T00:00:00.000Z', lastOpenedAt: '2026-10-01T00:00:00.000Z',
  }] });
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
  cleanup(); localStorage.clear(); vi.unstubAllGlobals();
  useToolsStore.setState(originalTools); useProjectStore.setState(originalProjects);
});
const save = (suffix: string, value: unknown) => localStorage.setItem(`seomi_project_${projectId}_${suffix}`, JSON.stringify(value));

it('rejects nested malformed domain evidence before rendering the overview', async () => {
  save('domain_overview_v1', {
    domain: 'example.com', organic_traffic: 0, organic_keywords: null, domain_rank: null, referring_domains: null,
    top_keywords: [null], top_pages: [], competitors: [],
  });
  await useToolsStore.getState().hydrateProject(projectId);
  expect(() => render(<DomainOverview />)).not.toThrow();
  expect(useToolsStore.getState().domainOverview).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

it('rejects malformed backlink anchor evidence before rendering', async () => {
  save('backlink_profile_v1', {
    domain: 'example.com', total_backlinks: 0, referring_domains: 0, referring_subnets: null, domain_rank: 0,
    dofollow_ratio: null, total_anchor_rows: null, total_backlink_rows: null, anchors: [null], backlinks: [],
  });
  await useToolsStore.getState().hydrateProject(projectId);
  expect(() => render(<BacklinkChecker />)).not.toThrow();
  expect(useToolsStore.getState().backlinkProfile).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

it('filters invalid AI history entries independently without failing project hydration', async () => {
  const validBrand = { brand: 'Brand', domain: 'example.com', timestamp: '2026-10-01', overall_score: null, query_checked: '', key_takeaways: [], models: [] };
  const validPrompt = { prompt: 'Question', captured_at: '2026-10-01', results: [] };
  save('ai_brand_report_v1', [null, { ...validBrand, models: [null] }, validBrand]);
  save('ai_prompt_comparison_v1', [null, { ...validPrompt, results: [null] }, validPrompt]);
  await expect(useToolsStore.getState().hydrateProject(projectId)).resolves.toBeUndefined();
  expect(useToolsStore.getState().aiBrandHistory).toEqual([validBrand]);
  expect(useToolsStore.getState().aiPromptHistory).toEqual([validPrompt]);
});

it('keeps object/boolean/number input drafts out of text state', async () => {
  save('ai_research_inputs_v1', { brand: {}, domain: false, prompt: 42 });
  await useToolsStore.getState().hydrateProject(projectId);
  expect(useToolsStore.getState().aiBrandQuery).toBe('');
  expect(useToolsStore.getState().aiBrandDomain).toBe('');
  expect(useToolsStore.getState().aiSearchPrompt).toBe('');
});


it('preserves deliberately cleared drafts instead of restoring the previous report query', async () => {
  save('ai_brand_report_v1', { brand: 'Old brand', domain: 'old.example', timestamp: '2026-10-01', overall_score: null, query_checked: '', key_takeaways: [], models: [] });
  save('ai_prompt_comparison_v1', { prompt: 'Old question', captured_at: '2026-10-01', results: [] });
  save('ai_research_inputs_v1', { brand: '', domain: '', prompt: '' });
  await useToolsStore.getState().hydrateProject(projectId);
  expect(useToolsStore.getState().aiBrandQuery).toBe('');
  expect(useToolsStore.getState().aiBrandDomain).toBe('');
  expect(useToolsStore.getState().aiSearchPrompt).toBe('');
});

it.each([null, 42, [], { prompts: [null, ' Question ', false], competitors: [42, ' Rival '], repetitions: {} }])('recovers invalid settings independently: %j', async (value) => {
  save('ai_research_settings_v1', value);
  await useToolsStore.getState().hydrateProject(projectId);
  expect(useToolsStore.getState().aiResearchSettings).toEqual({
    prompts: value && typeof value === 'object' && !Array.isArray(value) ? ['Question'] : [],
    competitors: value && typeof value === 'object' && !Array.isArray(value) ? ['Rival'] : [],
    repetitions: 1,
  });
});
