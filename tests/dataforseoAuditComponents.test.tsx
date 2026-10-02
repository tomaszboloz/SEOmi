import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DataForSEOAudit } from '../src/components/Results/DataForSEOAudit';
import { DataForSeoCredentialsCard } from '../src/components/Results/dataforseoAudit/DataForSeoCredentialsCard';
import { DataForSeoTaskLogCard } from '../src/components/Results/dataforseoAudit/DataForSeoTaskLogCard';
import { DataForSeoSummaryCard } from '../src/components/Results/dataforseoAudit/DataForSeoSummaryCard';
import { DataForSeoSerpCard } from '../src/components/Results/dataforseoAudit/DataForSeoSerpCard';
import { useAuditStore } from '../src/stores/auditStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { useProjectStore } from '../src/stores/projectStore';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    useTranslation: () => ({
      t: (key: string) => key,
    }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
  };
});

vi.mock('../src/stores/auditStore', () => ({
  useAuditStore: vi.fn(),
}));

vi.mock('../src/stores/settingsStore', () => ({
  useSettingsStore: vi.fn(),
}));

vi.mock('../src/stores/projectStore', () => ({
  useProjectStore: vi.fn(),
}));

describe('DataForSEOAudit Decomposition', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useAuditStore as any).mockImplementation((selector: any) => {
      const store = {
        dataforseoData: { total_backlinks: 100, referring_domains: 50, dofollow_backlinks: 80, rank: 60, broken_backlinks: 2 },
        dataforseoSerp: [{ rank_group: 1, domain: 'example.com', title: 'Example', description: 'Desc', url: 'https://example.com' }],
        isDataForSEOLoading: false,
        dataforseoError: null,
        fetchDataForSEO: vi.fn(),
        fetchDataForSEOSerp: vi.fn(),
      };
      return selector(store);
    });

    (useSettingsStore as any).mockImplementation((selector: any) => {
      const store = {
        dataForSeoCredentials: { login: 'test_login', password: 'test_password' },
        saveDataForSeoCredentials: vi.fn().mockResolvedValue(true),
      };
      return selector(store);
    });

    (useProjectStore as any).mockImplementation((selector: any) => {
      const store = {
        activeProjectId: 'proj1',
        projects: [{ id: 'proj1', rootUrl: 'https://mysite.com' }],
      };
      return selector(store);
    });
  });

  it('renders the facade with all subcomponents', () => {
    render(<DataForSEOAudit />);
    expect(screen.getByText('dataforseo.title')).toBeDefined();
    expect(screen.getByText('dataforseo.taskState')).toBeDefined();
    expect(screen.getByText('dataforseo.totalBacklinks')).toBeDefined();
    expect(screen.getByText('dataforseo.serpTitle')).toBeDefined();
  });

  it('renders credentials card correctly', () => {
    render(<DataForSeoCredentialsCard currentDomain="mysite.com" />);
    expect(screen.getByText('dataforseo.title')).toBeDefined();
    expect(screen.getByText('mysite.com')).toBeDefined();
  });

  it('renders summary card correctly', () => {
    render(<DataForSeoSummaryCard />);
    expect(screen.getByText('100')).toBeDefined();
    expect(screen.getByText('50')).toBeDefined();
  });

  it('renders SERP card correctly', () => {
    render(<DataForSeoSerpCard />);
    expect(screen.getByText('example.com')).toBeDefined();
  });

  it('renders Task Log card correctly', () => {
    render(<DataForSeoTaskLogCard />);
    expect(screen.getByText('dataforseo.taskState')).toBeDefined();
  });
});
