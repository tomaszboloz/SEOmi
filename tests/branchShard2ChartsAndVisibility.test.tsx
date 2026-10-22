import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import type { TFunction } from 'i18next';
import type { BrandAiVisibilityReport } from '@/types';
import { AiBrandOverviewCards } from '@/components/AiVisibility/brandVisibility/AiBrandOverviewCards';
import { AiSearchPromptForm } from '@/components/AiVisibility/searchPrompts/AiSearchPromptForm';
import { DiagnosisAreaList } from '@/components/Charts/crawlArchitecture/topicalDiagnosis/DiagnosisAreaList';
import type { TopicalDiagnosisReport } from '@/services/topicalDiagnosis';
import { readOllamaAssistantInstruction, ollamaAssistantInstructionKey, OLLAMA_ASSISTANT_MAX_INSTRUCTION_CHARS } from '@/components/AI/ollama/ollamaAssistantStorage';
import { SearchConsoleControls } from '@/components/AgentWorkflows/searchConsole/Controls';
import type { SearchConsoleSession } from '@/components/AgentWorkflows/searchConsole/useSearchConsoleSession';

const t = i18n.t.bind(i18n) as unknown as TFunction;

describe('AiBrandOverviewCards', () => {
  it('shows a dash for a missing share of voice when a methodology exists', () => {
    const report = {
      methodology: { name: 'm' }, overall_score: 40, share_of_voice: null, key_takeaways: [], timestamp: '2026-10-01T00:00:00Z',
    } as unknown as BrandAiVisibilityReport;
    render(<AiBrandOverviewCards report={report} t={t} />);
    expect(screen.getByText(t('aiResearch.shareOfVoice', { value: '—' }) as string)).toBeTruthy();
  });
});

describe('AiSearchPromptForm', () => {
  it('disables submit and shows the loading label while a run is in flight', () => {
    render(<AiSearchPromptForm prompt="q" isLoading samplePrompts={['one']} onChangePrompt={vi.fn()} onSubmit={vi.fn()} onSelectSample={vi.fn()} t={t} />);
    const button = screen.getByText(t('aiVisibility.search.runLoading') as string).closest('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.queryByText(t('aiVisibility.search.run') as string)).toBeNull();
  });
});

describe('ollama assistant instruction storage', () => {
  it('discards a stored instruction that exceeds the maximum length', () => {
    localStorage.setItem(ollamaAssistantInstructionKey('p1'), 'x'.repeat(OLLAMA_ASSISTANT_MAX_INSTRUCTION_CHARS + 1));
    expect(readOllamaAssistantInstruction('p1')).toBe('');
    localStorage.setItem(ollamaAssistantInstructionKey('p1'), 'short');
    expect(readOllamaAssistantInstruction('p1')).toBe('short');
  });
});

describe('DiagnosisAreaList rows', () => {
  const doc = (id: string, url: string) => ({ id, urls: new Set([url]), primaryPage: { url } });
  const report = {
    documents: [doc('doc-0', 'https://ex.test/hub/'), doc('doc-1', 'https://ex.test/a/')],
    areas: [
      { id: 'area-0', label: 'Hub area', hubId: 'doc-0', documentIds: ['doc-1'] },
      { id: 'area-1', label: 'Lonely hub', hubId: 'doc-0', documentIds: [] },
    ],
    topics: [
      { id: 'topic-0', label: '', labelSource: 'none', documentIds: ['doc-1'] },
      { id: 'topic-1', label: 'Derived label', labelSource: 'content', documentIds: ['doc-1'] },
    ],
  } as unknown as TopicalDiagnosisReport;

  it('marks unlabeled topics, notes content-derived labels and explains a hub without members', () => {
    const onShowInGraph = vi.fn();
    render(<DiagnosisAreaList report={report} onShowInGraph={onShowInGraph} />);
    expect(screen.getAllByText(t('topicalDiagnosis.topics.noLabel') as string)).toHaveLength(1);
    expect(screen.getAllByText(`(${t('topicalDiagnosis.topics.labelFromContent')})`)).toHaveLength(1);
    expect(screen.getByText(t('topicalDiagnosis.areas.hubWithoutMembers') as string)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: t('topicalDiagnosis.areas.showInGraph') as string })[0]);
    expect(onShowInGraph).toHaveBeenCalledWith({ kind: 'area', id: 'area-0' });
  });
});

describe('SearchConsoleControls property select', () => {
  it('offers a disabled placeholder option when no property matches', () => {
    const session = {
      t, activeProjectId: 'p', gscProperties: [{ siteUrl: 'sc-domain:a.test', permissionLevel: 'siteOwner' }], gscProperty: '',
      gscFilters: { search_type: '', device: '', country: '' }, gscData: null, setGscProperty: vi.fn(), dateRangeError: '',
      updateFilter: vi.fn(), handleSaveSnapshot: vi.fn(), dateRange: { startDate: '2026-09-01', endDate: '2026-09-30' },
      setDateRange: vi.fn(), trackerMessage: '',
    } as unknown as SearchConsoleSession;
    render(<SearchConsoleControls session={session} />);
    const placeholder = screen.getByRole('option', { name: t('searchConsole.noMatchingProperty') as string }) as HTMLOptionElement;
    expect(placeholder.disabled).toBe(true);
  });
});

describe('CrawlArchitectureGraph reduced motion', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); vi.doUnmock('@/components/Charts/crawlArchitecture/CrawlArchitectureHeader'); });

  it('scrolls the selected map tab without smooth animation when reduced motion is requested', async () => {
    vi.resetModules();
    const scrollIntoView = vi.fn();
    vi.doMock('@/components/Charts/crawlArchitecture/CrawlArchitectureHeader', () => ({
      CrawlArchitectureHeader: ({ mapTabsRef }: { mapTabsRef: React.RefObject<HTMLDivElement> }) => (
        <div ref={mapTabsRef}><button aria-selected="true" ref={(el) => { if (el) el.scrollIntoView = scrollIntoView; }}>tab</button></div>
      ),
    }));
    vi.doMock('@/components/Charts/crawlArchitecture/CrawlArchitectureBottomNav', () => ({ CrawlArchitectureBottomNav: () => null }));
    vi.doMock('@/components/Charts/crawlArchitecture/CrawlArchitectureMainContent', () => ({ CrawlArchitectureMainContent: () => null }));
    vi.doMock('@/components/Charts/crawlArchitecture/useCrawlArchitectureState', () => ({ useCrawlArchitectureState: () => ({ activeView: 'graph', setActiveView: vi.fn() }) }));
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const { CrawlArchitectureGraph } = await import('@/components/Charts/CrawlArchitectureGraph');
    render(<CrawlArchitectureGraph pages={[]} startUrl="https://a.test/" crawlMode="http" />);
    expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }));
    vi.doUnmock('@/components/Charts/crawlArchitecture/CrawlArchitectureBottomNav');
    vi.doUnmock('@/components/Charts/crawlArchitecture/CrawlArchitectureMainContent');
    vi.doUnmock('@/components/Charts/crawlArchitecture/useCrawlArchitectureState');
  });
});
