import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageSpeedWorkspace } from '@/components/Performance/PageSpeedWorkspace';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
    }),
    initReactI18next: {
      type: '3rdParty',
      init: vi.fn(),
    }
  };
});

vi.mock('@/stores/projectStore', () => {
  const state = { activeProjectId: 'proj1', projects: [{ id: 'proj1', rootUrl: 'https://example.com' }] };
  // getState is read at import time by stores that this workspace reaches through the export chain.
  return { useProjectStore: Object.assign(vi.fn((selector) => selector(state)), { getState: () => state }) };
});

vi.mock('@/stores/settingsStore', () => ({
  useSettingsStore: vi.fn((selector) => selector({ googleMetricsApiKey: 'fake-key' })),
}));

vi.mock('@/components/Charts/TrendChart', () => ({
  TrendChart: () => <div data-testid="trend-chart" />,
}));

describe('PageSpeedWorkspace components', () => {
  it('renders the facade correctly', () => {
    render(<PageSpeedWorkspace />);
    expect(screen.getByText('pageSpeedUi.title')).toBeDefined();
    expect(screen.getByText('pageSpeedUi.badge')).toBeDefined();
  });
});
