import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTopicalLabels } from '@/components/Charts/semanticTopical/session/useTopicalLabels';
import { defaultSessionDependencies } from '@/components/Charts/semanticTopical/session/topicalSessionTypes';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

describe('Topical session modular architecture', () => {
  it('satisfies physical LOC <= 150 for all topical session modules', () => {
    const files = [
      'src/components/Charts/semanticTopical/useSemanticTopicalSession.ts',
      ...codeFiles('src/components/Charts/semanticTopical/session'),
    ];
    expect(files.length).toBeGreaterThanOrEqual(6);
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('exposes default session dependencies', () => {
    expect(typeof defaultSessionDependencies.readMap).toBe('function');
    expect(typeof defaultSessionDependencies.writeMap).toBe('function');
    expect(typeof defaultSessionDependencies.readPreferences).toBe('function');
    expect(typeof defaultSessionDependencies.writePreferences).toBe('function');
  });

  it('returns valid intent and lifecycle labels from useTopicalLabels', () => {
    const { result } = renderHook(() => useTopicalLabels());
    expect(result.current.intentLabels.informational).toBeTruthy();
    expect(result.current.lifecycleLabels.planned).toBeTruthy();
    expect(result.current.nodeKindLabels.pillar).toBeTruthy();
    expect(result.current.sourceMetric(null)).toBeTruthy();
    expect(result.current.sourceMetric(1234)).toBe((1234).toLocaleString());
  });
});
