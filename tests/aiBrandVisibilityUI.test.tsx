import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AiBrandVisibility } from '@/components/AiVisibility/AiBrandVisibility';
import { useToolsStore } from '@/stores/toolsStore';
import { useProjectStore } from '@/stores/projectStore';
import type { BrandAiVisibilityReport } from '@/types';
import i18n from '@/i18n';

const originalTools = useToolsStore.getState();
const originalProjects = useProjectStore.getState();
const report = (extra: Partial<BrandAiVisibilityReport> = {}): BrandAiVisibilityReport => ({
  brand: 'SEOmi', domain: 'seomi.test', overall_score: 100, query_checked: 'Which audit tool?',
  timestamp: '2026-10-01T10:00:00Z', key_takeaways: [], models: [], ...extra,
});

describe('AI brand visibility research controls', () => {
  beforeEach(() => {
    localStorage.clear();
    useProjectStore.setState({ projects: [], activeProjectId: 'brand-ui' });
    useToolsStore.setState({ aiBrandQuery: 'SEOmi', aiBrandDomain: 'seomi.test', aiBrandReport: null,
      aiBrandHistory: [], aiBrandError: null, isAiBrandLoading: false,
      aiResearchSettings: { prompts: [], competitors: [], repetitions: 1 }, analyzeAiBrandVisibility: vi.fn() });
    localStorage.setItem('seomi_active_project_v1', 'brand-ui');
  });
  afterEach(() => { cleanup(); useToolsStore.setState(originalTools); useProjectStore.setState(originalProjects); });

  it('does not run subscription research on mount and submits project-owned questions and competitors', () => {
    render(<AiBrandVisibility />);
    const run = vi.mocked(useToolsStore.getState().analyzeAiBrandVisibility);
    expect(run).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(i18n.t('aiResearch.prompts')), { target: { value: 'Which audit tool?\nWho offers audits?' } });
    fireEvent.blur(screen.getByLabelText(i18n.t('aiResearch.prompts')));
    fireEvent.change(screen.getByLabelText(i18n.t('aiResearch.competitors')), { target: { value: 'OtherBrand\nSecondBrand' } });
    fireEvent.blur(screen.getByLabelText(i18n.t('aiResearch.competitors')));
    fireEvent.change(screen.getByLabelText(i18n.t('aiResearch.repetitions')), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('aiVisibility.brand.analyze') }));
    expect(run).toHaveBeenCalledWith('SEOmi', 'seomi.test');
    expect(useToolsStore.getState().aiResearchSettings).toEqual({ prompts: ['Which audit tool?', 'Who offers audits?'], competitors: ['OtherBrand', 'SecondBrand'], repetitions: 3 });
    expect(JSON.parse(localStorage.getItem('seomi_project_brand-ui_ai_research_settings_v1') || 'null')).toEqual(useToolsStore.getState().aiResearchSettings);
  });

  it('keeps historical branded recognition reports readable without displaying their score as visibility', () => {
    useToolsStore.setState({ aiBrandReport: report() });
    render(<AiBrandVisibility />);
    expect(screen.getByText(i18n.t('aiResearch.legacyRecognition'))).toBeTruthy();
    expect(screen.getByText(i18n.t('aiResearch.legacyNote'))).toBeTruthy();
    expect(screen.queryByText('100%')).toBeNull();
  });

  it('shows per-run search mode, tracked position, competitors and own-domain citations', () => {
    useToolsStore.setState({ aiBrandReport: report({ methodology: 'unbranded_prompts', share_of_voice: 50, models: [{
      model_name: 'Claude local', model_id: null, provider: 'claude', connection_method: 'local_cli',
      captured_at: '2026-10-01T10:00:00Z', is_present: true, visibility_percentage: 100, sentiment: 'not_assessed',
      summary: 'OtherBrand and SEOmi', cited_sources: ['https://seomi.test/source'], prompt: 'Which audit tool?',
      repetition: 2, search_mode: 'web_enabled', mention_position: 2, own_domain_cited: true,
      competitors_mentioned: ['OtherBrand'], response_status: 'success',
    }] }) });
    render(<AiBrandVisibility />);
    expect(screen.getByText('100%')).toBeTruthy();
    expect(screen.getByText(i18n.t('aiResearch.shareOfVoice', { value: '50%' }))).toBeTruthy();
    expect(screen.getByText(/Which audit tool/)).toBeTruthy();
    expect(screen.getByText('OtherBrand')).toBeTruthy();
    expect(screen.getByText((text) => text.includes(i18n.t('aiResearch.web_enabled')) && text.includes(i18n.t('aiResearch.position', { value: 2 })) && text.includes(i18n.t('aiResearch.ownDomainYes')))).toBeTruthy();
    expect(screen.getByRole('link', { name: 'https://seomi.test/source' }).getAttribute('href')).toBe('https://seomi.test/source');
  });

  it('disables duplicate submissions while a run is loading', () => {
    useToolsStore.setState({ isAiBrandLoading: true });
    render(<AiBrandVisibility />);
    const button = screen.getByRole('button', { name: i18n.t('aiVisibility.brand.queryLoading') }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(useToolsStore.getState().analyzeAiBrandVisibility).not.toHaveBeenCalled();
  });

  it('replaces research drafts when the active project changes', () => {
    useToolsStore.setState({ aiResearchSettings: { prompts: ['First project question'], competitors: ['First competitor'], repetitions: 2 } });
    const view = render(<AiBrandVisibility />);
    expect((screen.getByLabelText(i18n.t('aiResearch.prompts')) as HTMLTextAreaElement).value).toBe('First project question');
    useProjectStore.setState({ activeProjectId: 'brand-ui-two' });
    useToolsStore.setState({ aiResearchSettings: { prompts: ['Second project question'], competitors: [], repetitions: 1 } });
    view.rerender(<AiBrandVisibility />);
    expect((screen.getByLabelText(i18n.t('aiResearch.prompts')) as HTMLTextAreaElement).value).toBe('Second project question');
    expect((screen.getByLabelText(i18n.t('aiResearch.competitors')) as HTMLTextAreaElement).value).toBe('');
  });
});
