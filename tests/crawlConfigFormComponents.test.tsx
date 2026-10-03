import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CrawlLimitsConfig } from '@/components/Domain/siteAudit/configForm/CrawlLimitsConfig';
import { CrawlScopeConfig } from '@/components/Domain/siteAudit/configForm/CrawlScopeConfig';
import { CrawlRulesConfig } from '@/components/Domain/siteAudit/configForm/CrawlRulesConfig';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

const mockT = ((key: string) => key) as any;

const makeMockSession = (overrides?: Record<string, any>) => ({
  crawlConfig: {
    maxDepth: 3,
    maxRedirects: 10,
    maxResponseBytes: 5_000_000,
    maxRunSeconds: 60,
    includePatterns: ['^/blog'],
    excludePatterns: ['^/admin'],
    allowSubdomains: true,
    allowedHosts: ['example.com'],
    scopePath: '/shop',
    keepQueryStrings: true,
    respectRobots: true,
    respectCrawlDelay: false,
    discoverSitemaps: true,
    followNofollow: false,
    listMode: false,
    focusPhrase: 'seo audit',
    crawlImages: false,
    crawlStylesheets: false,
    crawlScripts: false,
    crawlOtherResources: false,
  },
  setCrawlConfig: vi.fn(),
  setFilterPatterns: vi.fn(),
  setAllowedHosts: vi.fn(),
  setQueryParameterNames: vi.fn(),
  importSeedUrls: vi.fn(),
  seedImportRejected: [],
  t: mockT,
  ...overrides,
});

describe('CrawlConfigurationForm modular architecture', () => {
  it('satisfies physical LOC <= 150 across CrawlConfigurationForm and submodules', () => {
    const files = [
      'src/components/Domain/siteAudit/CrawlConfigurationForm.tsx',
      ...codeFiles('src/components/Domain/siteAudit/configForm'),
    ];
    expect(files.length).toBe(6);
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('renders CrawlLimitsConfig and handles maxDepth input changes', () => {
    const setCrawlConfig = vi.fn();
    const session = makeMockSession({ setCrawlConfig }) as any;
    render(<CrawlLimitsConfig session={session} />);

    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs.length).toBeGreaterThanOrEqual(4);
    fireEvent.change(inputs[0], { target: { value: '5' } });
    expect(setCrawlConfig).toHaveBeenCalledWith({ maxDepth: 5 });
  });

  it('renders CrawlScopeConfig and handles includePatterns changes', () => {
    const setFilterPatterns = vi.fn();
    const session = makeMockSession({ setFilterPatterns }) as any;
    render(<CrawlScopeConfig session={session} />);

    const textareas = screen.getAllByRole('textbox');
    expect(textareas.length).toBeGreaterThanOrEqual(2);
    fireEvent.change(textareas[0], { target: { value: '^/products' } });
    expect(setFilterPatterns).toHaveBeenCalledWith('includePatterns', '^/products');
  });

  it('renders CrawlRulesConfig and toggles checkboxes', () => {
    const setCrawlConfig = vi.fn();
    const session = makeMockSession({ setCrawlConfig }) as any;
    render(<CrawlRulesConfig session={session} />);

    const robotsCheckbox = screen.getByLabelText('siteAudit.respectRobots');
    fireEvent.click(robotsCheckbox);
    expect(setCrawlConfig).toHaveBeenCalledWith({ respectRobots: false });
  });
});
