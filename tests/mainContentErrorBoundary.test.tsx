import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MainContent } from '@/components/Layout/MainContent';
import { useAuditStore } from '@/stores/auditStore';

vi.mock('@/components/Layout/mainContent/PageAuditTabPanel', () => ({
  PageAuditTabPanel: ({ activeTab }: { activeTab: string }) => {
    if (activeTab === 'metadata') {
      throw new Error('Simulated route crash');
    }
    return <div data-testid="page-audit-panel" />;
  },
}));

describe('MainContent RouteErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    useAuditStore.setState({ activeTab: 'metadata' });
  });

  it('resets activeTab to overview when clicking onBack in route error boundary', () => {
    render(<MainContent />);
    const backBtn = screen.getByRole('button', { name: /overview/i });
    fireEvent.click(backBtn);
    expect(useAuditStore.getState().activeTab).toBe('overview');
  });
});
