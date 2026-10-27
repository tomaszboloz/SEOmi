import { describe, expect, it, vi } from 'vitest';
import { render, screen, renderHook, fireEvent } from '@testing-library/react';
import { BacklinkHeader } from '@/components/Domain/backlinkChecker/BacklinkHeader';
import { BacklinkGapSection } from '@/components/Domain/backlinkChecker/BacklinkGapSection';
import { useBacklinkSession, type BacklinkSession } from '@/components/Domain/backlinkChecker/useBacklinkSession';

const createMockSession = (overrides: Partial<BacklinkSession> = {}): BacklinkSession => ({
  t: ((key: string) => key) as any,
  inputTarget: 'example.com',
  setInputTarget: vi.fn(),
  isLoading: false,
  error: null,
  competitorInput: '',
  setCompetitorInput: vi.fn(),
  parsedCompetitors: [],
  backlinkGapIncludeSubdomains: true,
  setBacklinkGapIncludeSubdomains: vi.fn(),
  backlinkGapReport: null,
  isBacklinkGapLoading: false,
  backlinkGapError: null,
  setBacklinkGapCompetitors: vi.fn(),
  handleAnalyze: vi.fn(),
  handleAnalyzeGap: vi.fn(),
  loadMoreBacklinkGap: vi.fn(),
  ...overrides,
} as unknown as BacklinkSession);

describe('BacklinkHeader and BacklinkGapSection direct assertions', () => {
  it('BacklinkHeader renders title and input controls, and handles events', () => {
    const setInputTarget = vi.fn();
    const handleAnalyze = vi.fn((e) => e.preventDefault());
    const session = createMockSession({ setInputTarget, handleAnalyze, isLoading: false });
    const { rerender } = render(<BacklinkHeader session={session} />);

    expect(screen.getByText('backlinkUi.title')).toBeDefined();
    const input = screen.getByDisplayValue('example.com');
    fireEvent.change(input, { target: { value: 'new.example' } });
    expect(setInputTarget).toHaveBeenCalledWith('new.example');

    fireEvent.submit(input.closest('form')!);
    expect(handleAnalyze).toHaveBeenCalled();

    rerender(<BacklinkHeader session={{ ...session, isLoading: true }} />);
    expect(screen.getByText('backlinkUi.scanning')).toBeDefined();
  });


  it('BacklinkGapSection renders section title, controls, and handles events', () => {
    const setCompetitorInput = vi.fn();
    const setBacklinkGapCompetitors = vi.fn();
    const setBacklinkGapIncludeSubdomains = vi.fn();
    const handleAnalyzeGap = vi.fn();
    const loadMoreBacklinkGap = vi.fn();

    const session = createMockSession({
      competitorInput: 'comp1.com\ncomp2.com',
      parsedCompetitors: ['comp1.com', 'comp2.com'],
      setCompetitorInput,
      setBacklinkGapCompetitors,
      setBacklinkGapIncludeSubdomains,
      handleAnalyzeGap,
      loadMoreBacklinkGap,
      backlinkGapError: 'Failed gap analysis',
      backlinkGapReport: {
        target: 'example.com',
        opportunities: [],
        rows_scanned: 0,
        total_rows: 10,
        competitors: ['comp1.com'],
      } as any,
    });

    const { rerender } = render(<BacklinkGapSection session={session} />);

    expect(screen.getByText('Failed gap analysis')).toBeDefined();
    const textarea = screen.getByPlaceholderText('backlinkUi.competitorPlaceholder');
    fireEvent.change(textarea, { target: { value: 'a.com, b.com' } });
    expect(setCompetitorInput).toHaveBeenCalledWith('a.com, b.com');
    expect(setBacklinkGapCompetitors).toHaveBeenCalledWith(['a.com', 'b.com']);

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(setBacklinkGapIncludeSubdomains).toHaveBeenCalled();

    const loadMoreBtn = screen.getByRole('button', { name: /loadMoreGap/i });
    fireEvent.click(loadMoreBtn);
    expect(loadMoreBacklinkGap).toHaveBeenCalled();

    const btn = screen.getByRole('button', { name: /analyzeGap/i });
    fireEvent.click(btn);
    expect(handleAnalyzeGap).toHaveBeenCalledOnce();

    rerender(<BacklinkGapSection session={{ ...session, isBacklinkGapLoading: true }} />);
    expect(screen.getByRole('button', { name: /analyzeGap/i })).toHaveProperty('disabled', true);
  });

  it('useBacklinkSession hook initializes cleanly with default values', () => {
    const { result, unmount } = renderHook(() => useBacklinkSession());
    expect(result.current).toBeDefined();
    expect(result.current.inputTarget).toBeDefined();
    expect(result.current.isLoading).toBe(false);
    unmount();
  });
});
