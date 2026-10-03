import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MainContentStatusBars } from '@/components/Layout/mainContent/MainContentStatusBars';
import { PageAuditTabPanel } from '@/components/Layout/mainContent/PageAuditTabPanel';
import { StandaloneWorkflowTabs } from '@/components/Layout/mainContent/StandaloneWorkflowTabs';
import { useAuditStore } from '@/stores/auditStore';

const mockT = (key: string) => key;

describe('MainContent submodules', () => {
  beforeEach(() => {
    useAuditStore.setState({ error: null, isLoading: false, currentAudit: null, activeTab: 'overview' });
  });

  it('renders loading bar and error alert in MainContentStatusBars', () => {
    useAuditStore.setState({ error: 'Connection failed' });
    render(
      <MainContentStatusBars
        isLoading={true}
        error="Connection failed"
        t={mockT}
      />
    );
    expect(screen.getByText(/app\.loading/)).toBeDefined();
    expect(screen.getByText('Connection failed')).toBeDefined();

    const dismissBtn = screen.getByRole('button', { name: 'mainContent.dismissError' });
    fireEvent.click(dismissBtn);
    expect(useAuditStore.getState().error).toBeNull();
  });

  it('renders no-audit placeholder in PageAuditTabPanel when no currentAudit', () => {
    render(
      <PageAuditTabPanel
        currentAudit={null}
        activeTab="overview"
        pageAuditRoute={true}
        t={mockT}
      />
    );
    expect(screen.getByText('mainContent.noAuditTitle')).toBeDefined();
    expect(screen.getByText('mainContent.noAuditDescription')).toBeDefined();
  });

  it('renders standalone workflow tabs container', () => {
    const { container } = render(<StandaloneWorkflowTabs activeTab="seo-tools" />);
    expect(container).toBeDefined();
  });
});
