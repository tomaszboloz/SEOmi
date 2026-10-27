import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SijaPanel } from '@/components/Charts/SijaPanel';
import type { ObservedMicroIntent } from '@/services/sija/types';

const scores = { definitional: 0, 'how-to': 0, troubleshooting: 0, comparison: 0, 'curated-list': 0, tool: 0, transactional: 0, local: 0 };

describe('SijaPanel', () => {
  it('shows empty and inconclusive states', () => {
    const none: ObservedMicroIntent = { primary: null, mixed: [], confidence: 0, scores, evidence: [] };
    const { container } = render(<SijaPanel intent={none} ssas={{ status: 'inconclusive', score: null, benchmarkPages: 2 }} />);
    expect(container.textContent).toContain('sijaUi.empty');
    expect(container.textContent).toContain('sijaUi.inconclusive');
  });
  it('shows intent, mixed list and score', () => {
    const intent: ObservedMicroIntent = { primary: 'tool', mixed: ['local'], confidence: 0.7, scores, evidence: [] };
    const { container } = render(<SijaPanel intent={intent} ssas={{ status: 'mismatch', score: 40, benchmarkPages: 5 }} />);
    expect(container.textContent).toContain('sijaUi.primary');
    expect(container.textContent).toContain('sijaUi.mixed');
    expect(container.textContent).toContain('sijaUi.ssas.mismatch');
    const single = render(<SijaPanel intent={{ ...intent, mixed: [] }} ssas={{ status: 'aligned', score: 90, benchmarkPages: 5 }} />);
    expect(single.container.textContent).not.toContain('sijaUi.mixed');
  });
});
