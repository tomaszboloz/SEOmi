import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { useSiteAuditSession } from '@/components/Domain/siteAudit/useSiteAuditSession';
import { CrawlLimitsConfig } from '@/components/Domain/siteAudit/configForm/CrawlLimitsConfig';
import { CrawlResourceConfig } from '@/components/Domain/siteAudit/configForm/CrawlResourceConfig';
import { CrawlScopeConfig } from '@/components/Domain/siteAudit/configForm/CrawlScopeConfig';

type Session = ReturnType<typeof useSiteAuditSession>;
const t = (key: string) => key;
const session = (patch: Record<string, unknown> = {}) => ({
  crawlConfig: {
    maxDepth: undefined, maxRedirects: undefined, maxResponseBytes: undefined, maxRunSeconds: undefined,
    crawlImages: false, crawlStylesheets: false, crawlScripts: false, crawlOtherResources: false,
    includePatterns: [], excludePatterns: [], allowSubdomains: false, allowedHosts: undefined, scopePath: undefined,
    seedUrls: undefined,
  },
  setCrawlConfig: vi.fn(), setFilterPatterns: vi.fn(), setAllowedHosts: vi.fn(), importSeedUrls: vi.fn(),
  seedImportRejected: [], t, ...patch,
}) as unknown as Session;

describe('site audit configuration edge contracts', () => {
  it('uses limit defaults and handles empty and numeric limit inputs', () => {
    const setCrawlConfig = vi.fn();
    const view = render(<CrawlLimitsConfig session={session({ setCrawlConfig, crawlConfig: { ...session().crawlConfig, maxDepth: 3, maxRunSeconds: 60 } })} />);
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs[1]).toHaveProperty('value', '10');
    expect(inputs[2]).toHaveProperty('value', '5');
    view.rerender(<CrawlLimitsConfig session={session({ setCrawlConfig })} />);
    expect(screen.getAllByRole('spinbutton')[3]).toHaveProperty('value', '');
    view.rerender(<CrawlLimitsConfig session={session({ setCrawlConfig, crawlConfig: { ...session().crawlConfig, maxDepth: 3, maxRunSeconds: 60 } })} />);
    fireEvent.change(inputs[0], { target: { value: '' } });
    fireEvent.change(inputs[0], { target: { value: '7' } });
    fireEvent.change(inputs[3], { target: { value: '' } });
    fireEvent.change(inputs[3], { target: { value: '30' } });
    expect(setCrawlConfig).toHaveBeenCalledWith({ maxDepth: undefined });
    expect(setCrawlConfig).toHaveBeenCalledWith({ maxDepth: 7 });
    expect(setCrawlConfig).toHaveBeenCalledWith({ maxRunSeconds: undefined });
    expect(setCrawlConfig).toHaveBeenCalledWith({ maxRunSeconds: 30 });
  });

  it('shows resource controls, clamps empty concurrency and reports imported rows', () => {
    const setCrawlConfig = vi.fn();
    const importSeedUrls = vi.fn();
    const view = render(<CrawlResourceConfig session={session({
      setCrawlConfig, importSeedUrls, crawlConfig: { ...session().crawlConfig, crawlImages: true },
    })} />);
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs[0]).toHaveProperty('value', '250');
    expect(inputs[1]).toHaveProperty('value', '4');
    fireEvent.change(inputs[1], { target: { value: '' } });
    fireEvent.change(inputs[1], { target: { value: '8' } });
    fireEvent.change(view.container.querySelector('input[type="file"]')!, {
      target: { files: [new File(['url'], 'seed.csv', { type: 'text/csv' })] },
    });
    expect(setCrawlConfig).toHaveBeenCalledWith({ maxConcurrentRequests: 1 });
    expect(setCrawlConfig).toHaveBeenCalledWith({ maxConcurrentRequests: 8 });
    expect(importSeedUrls).toHaveBeenCalledOnce();

    view.rerender(<CrawlResourceConfig session={session({
      crawlConfig: { ...session().crawlConfig, seedUrls: ['https://seed.test'] }, seedImportRejected: ['bad'],
    })} />);
    expect(screen.getByText('siteAudit.urlsLoaded')).toBeTruthy();
    expect(screen.getByText('siteAudit.rowsRejected')).toBeTruthy();
  });

  it('preserves scope fallbacks and forwards both nonempty and empty paths', () => {
    const setCrawlConfig = vi.fn();
    const setAllowedHosts = vi.fn();
    const view = render(<CrawlScopeConfig session={session({ setCrawlConfig, setAllowedHosts })} />);
    const textboxes = screen.getAllByRole('textbox');
    expect(textboxes[2]).toHaveProperty('value', '');
    expect(textboxes[3]).toHaveProperty('value', '');
    fireEvent.change(textboxes[2], { target: { value: 'example.test\ncdn.test' } });
    view.rerender(<CrawlScopeConfig session={session({
      setCrawlConfig, setAllowedHosts,
      crawlConfig: { ...session().crawlConfig, scopePath: '/initial' },
    })} />);
    fireEvent.change(screen.getAllByRole('textbox')[3], { target: { value: '/docs' } });
    fireEvent.change(screen.getAllByRole('textbox')[3], { target: { value: '' } });
    expect(setAllowedHosts).toHaveBeenCalledWith('example.test\ncdn.test');
    expect(setCrawlConfig).toHaveBeenCalledWith({ scopePath: '/docs' });
    expect(setCrawlConfig).toHaveBeenCalledWith({ scopePath: undefined });
  });
});
