import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { OverviewContentCard } from '@/components/Results/overview/OverviewContentCard';
import { OverviewQuickWins } from '@/components/Results/overview/OverviewQuickWins';
import { useUIStore } from '@/stores/uiStore';
import type { PageAuditData } from '@/types';

const mockAudit = {
  content_stats: {
    word_count: 500,
    reading_time_minutes: 3,
    text_ratio_percent: 22.4,
  },
} as unknown as PageAuditData;

describe('OverviewContentCard and OverviewQuickWins actions', () => {
  beforeEach(() => {
    useUIStore.setState({ activeModal: null });
  });

  it('triggers openModal("ai") when clicking AI fix button in OverviewContentCard', () => {
    render(<OverviewContentCard audit={mockAudit} />);
    const aiButton = screen.getByRole('button');
    fireEvent.click(aiButton);
    expect(useUIStore.getState().activeModal).toBe('ai');
  });

  it('triggers openModal("ai") when clicking launch AI button in OverviewQuickWins', () => {
    render(<OverviewQuickWins issuesCount={2} />);
    const launchButton = screen.getByRole('button');
    fireEvent.click(launchButton);
    expect(useUIStore.getState().activeModal).toBe('ai');
  });
});
