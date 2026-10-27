import type React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TFunction } from 'i18next';
import { SearchConsoleHeader } from '@/components/AgentWorkflows/searchConsole/Header';
import type { SearchConsoleSession } from '@/components/AgentWorkflows/searchConsole/useSearchConsoleSession';
import { SecurityScoreBanner } from '@/components/Results/securityHeaders/SecurityScoreBanner';
import { DiagnosisVerdictList } from '@/components/Charts/crawlArchitecture/topicalDiagnosis/DiagnosisVerdictList';
import type { DiagnosisVerdict } from '@/services/topicalDiagnosis';
import { handlePickerKeyboardNav } from '@/components/DataForSEO/pickers/pickerKeyboardNav';
import { SidebarSearchField } from '@/components/Layout/sidebar/SidebarSearchField';
import { ProjectSwitcher } from '@/components/Projects/ProjectSwitcher';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';

afterEach(() => {
  cleanup();
  act(() => {
    useProjectStore.setState({ projects: [], activeProjectId: null });
    useUIStore.setState({ activeModal: null });
  });
});

describe('SearchConsoleHeader', () => {
  const session = (loading: boolean) => ({
    t: (key: string) => key, isGscConnected: true, gscProperty: 'sc-domain:x.test', isGscLoading: loading,
    disconnectGsc: vi.fn(), dateRangeError: null, handleRefresh: vi.fn(),
  }) as unknown as SearchConsoleSession;

  it('spins the refresh icon only while data is loading', () => {
    const { container, rerender } = render(<SearchConsoleHeader session={session(true)} />);
    expect(container.querySelector('svg.animate-spin')).not.toBeNull();
    rerender(<SearchConsoleHeader session={session(false)} />);
    expect(container.querySelector('svg.animate-spin')).toBeNull();
  });
});

describe('SecurityScoreBanner', () => {
  const t = ((key: string) => key) as unknown as TFunction;
  it.each([
    [90, 'legacyUi.security.hardened', 'text-emerald-400'],
    [60, 'legacyUi.security.moderate', 'text-amber-400'],
    [10, 'legacyUi.security.vulnerable', 'text-rose-400'],
  ])('renders the band for score %s', (score, heading, color) => {
    const { container } = render(<SecurityScoreBanner score={score} t={t} />);
    expect(screen.getByRole('heading', { name: heading })).toBeTruthy();
    expect(container.querySelector(`.${color}`)).not.toBeNull();
    if (score < 50) expect((container.firstChild as HTMLElement).className).toContain('bg-rose-500/10');
  });
});

describe('DiagnosisVerdictList', () => {
  const verdict = (confidence: DiagnosisVerdict['confidence']): DiagnosisVerdict => ({
    id: `topic-thin:${confidence}`, code: 'topic-thin', severity: 'weak', scope: 'topic', scopeId: 't-0', urls: [], evidence: [], confidence,
  });
  it('marks limited-confidence verdicts and leaves moderate ones unmarked', () => {
    const { container, rerender } = render(<DiagnosisVerdictList verdicts={[verdict('moderate')]} onOpenPage={vi.fn()} />);
    expect(container.querySelector('.text-amber-300')).toBeNull();
    rerender(<DiagnosisVerdictList verdicts={[verdict('limited')]} onOpenPage={vi.fn()} />);
    expect(container.querySelector('.text-amber-300')).not.toBeNull();
  });
});

describe('handlePickerKeyboardNav', () => {
  it('ignores keys that have no picker meaning', () => {
    const preventDefault = vi.fn(); const setOpen = vi.fn(); const setActiveIndex = vi.fn(); const choose = vi.fn();
    handlePickerKeyboardNav({ key: 'a', preventDefault } as unknown as React.KeyboardEvent<HTMLInputElement>, setOpen, setActiveIndex, 3, choose);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(setOpen).not.toHaveBeenCalled();
    expect(setActiveIndex).not.toHaveBeenCalled();
    expect(choose).not.toHaveBeenCalled();
  });
});

describe('SidebarSearchField', () => {
  it('clears the query on Escape only', () => {
    const update = vi.fn();
    render(<SidebarSearchField navQuery="abc" updateNavQuery={update} />);
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'a' });
    expect(update).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(update).toHaveBeenCalledWith('');
  });
});

describe('ProjectSwitcher', () => {
  it('shows an empty selection without an active project and ignores an empty choice', () => {
    const selectProject = vi.fn();
    useProjectStore.setState({ projects: [{ id: 'p1', name: 'One', createdAt: '2026-01-01T00:00:00Z' }] as never, activeProjectId: null, selectProject: selectProject as never });
    render(<ProjectSwitcher />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '' } });
    expect(selectProject).not.toHaveBeenCalled();
    fireEvent.change(select, { target: { value: 'p1' } });
    expect(selectProject).toHaveBeenCalledWith('p1');
  });
});
