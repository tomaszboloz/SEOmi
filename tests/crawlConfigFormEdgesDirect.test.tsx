import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CrawlLimitsConfig } from '@/components/Domain/siteAudit/configForm/CrawlLimitsConfig';
import { CrawlResourceConfig } from '@/components/Domain/siteAudit/configForm/CrawlResourceConfig';
import { CrawlRulesConfig } from '@/components/Domain/siteAudit/configForm/CrawlRulesConfig';

const t = ((k: string, opts?: { count?: number }) => (opts?.count != null ? `${k}:${opts.count}` : k)) as any;

describe('CrawlLimitsConfig coverage edges', () => {
  it('covers defaults and all onChange numeric inputs including maxRedirects', () => {
    const setCrawlConfig = vi.fn();
    const session = {
      crawlConfig: { maxDepth: 3, maxRedirects: 10, maxResponseBytes: 5_000_000, maxRunSeconds: 60 },
      setCrawlConfig,
      t,
    } as any;
    const { rerender } = render(<CrawlLimitsConfig session={session} />);

    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs[0].getAttribute('value')).toBe('3');
    expect(inputs[1].getAttribute('value')).toBe('10');
    expect(inputs[2].getAttribute('value')).toBe('5');
    expect(inputs[3].getAttribute('value')).toBe('60');

    fireEvent.change(inputs[1], { target: { value: '25' } });
    expect(setCrawlConfig).toHaveBeenCalledWith({ maxRedirects: 25 });

    fireEvent.change(inputs[0], { target: { value: '' } });
    expect(setCrawlConfig).toHaveBeenCalledWith({ maxDepth: undefined });
    fireEvent.change(inputs[0], { target: { value: '7' } });
    expect(setCrawlConfig).toHaveBeenCalledWith({ maxDepth: 7 });

    fireEvent.change(inputs[2], { target: { value: '8' } });
    expect(setCrawlConfig).toHaveBeenCalledWith({ maxResponseBytes: 8_000_000 });

    fireEvent.change(inputs[3], { target: { value: '' } });
    expect(setCrawlConfig).toHaveBeenCalledWith({ maxRunSeconds: undefined });
    fireEvent.change(inputs[3], { target: { value: '120' } });
    expect(setCrawlConfig).toHaveBeenCalledWith({ maxRunSeconds: 120 });

    rerender(<CrawlLimitsConfig session={{ crawlConfig: {}, setCrawlConfig, t } as any} />);
    const emptyInputs = screen.getAllByRole('spinbutton');
    expect(emptyInputs[0].getAttribute('value')).toBe('');
    expect(emptyInputs[1].getAttribute('value')).toBe('10');
    expect(emptyInputs[2].getAttribute('value')).toBe('5');
    expect(emptyInputs[3].getAttribute('value')).toBe('');
  });
});

describe('CrawlResourceConfig coverage edges', () => {
  it('toggles checkboxes, resources, concurrency clamping, and seed imports', () => {
    const setCrawlConfig = vi.fn();
    const importSeedUrls = vi.fn();
    const baseSession = {
      crawlConfig: { crawlImages: false, crawlStylesheets: false, crawlScripts: false, crawlOtherResources: false },
      importSeedUrls,
      seedImportRejected: [],
      setCrawlConfig,
      t,
    } as any;
    const { rerender } = render(<CrawlResourceConfig session={baseSession} />);
    expect(screen.queryByText('siteAudit.maxResources')).toBeNull();

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(setCrawlConfig).toHaveBeenCalledWith({ crawlImages: true });
    fireEvent.click(checkboxes[1]);
    expect(setCrawlConfig).toHaveBeenCalledWith({ crawlStylesheets: true });
    fireEvent.click(checkboxes[2]);
    expect(setCrawlConfig).toHaveBeenCalledWith({ crawlScripts: true });
    fireEvent.click(checkboxes[3]);
    expect(setCrawlConfig).toHaveBeenCalledWith({ crawlOtherResources: true });

    const populatedSession = {
      ...baseSession,
      crawlConfig: { crawlImages: true, seedUrls: ['https://example.com/seed'] },
      seedImportRejected: ['invalid-row'],
    };
    rerender(<CrawlResourceConfig session={populatedSession} />);

    expect(screen.getByText('siteAudit.urlsLoaded:1')).toBeTruthy();
    expect(screen.getByText('siteAudit.rowsRejected:1')).toBeTruthy();

    const [maxResInput, maxConcInput] = screen.getAllByRole('spinbutton');
    fireEvent.change(maxResInput, { target: { value: '500' } });
    expect(setCrawlConfig).toHaveBeenCalledWith({ maxResourceRequests: 500 });

    fireEvent.change(maxConcInput, { target: { value: '8' } });
    expect(setCrawlConfig).toHaveBeenCalledWith({ maxConcurrentRequests: 8 });
    fireEvent.change(maxConcInput, { target: { value: '30' } });
    expect(setCrawlConfig).toHaveBeenCalledWith({ maxConcurrentRequests: 16 });
    fireEvent.change(maxConcInput, { target: { value: '0' } });
    expect(setCrawlConfig).toHaveBeenCalledWith({ maxConcurrentRequests: 1 });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const dummyFile = new File(['url'], 'seeds.csv', { type: 'text/csv' });
    fireEvent.change(fileInput, { target: { files: [dummyFile] } });
    expect(importSeedUrls).toHaveBeenCalledWith(dummyFile);
    fireEvent.change(fileInput, { target: { files: [] } });
    expect(importSeedUrls).toHaveBeenCalledWith(undefined);
  });
});

describe('CrawlRulesConfig coverage edges', () => {
  it('toggles rule checkboxes and inputs focusPhrase', () => {
    const setCrawlConfig = vi.fn();
    const session = {
      crawlConfig: { respectRobots: false, respectCrawlDelay: false, discoverSitemaps: false, followNofollow: false, listMode: false, focusPhrase: undefined },
      setCrawlConfig,
      t,
    } as any;
    render(<CrawlRulesConfig session={session} />);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[1].hasAttribute('disabled')).toBe(true);

    fireEvent.click(checkboxes[0]);
    expect(setCrawlConfig).toHaveBeenCalledWith({ respectRobots: true });
    fireEvent.click(checkboxes[1]);
    expect(setCrawlConfig).toHaveBeenCalledWith({ respectCrawlDelay: true });
    fireEvent.click(checkboxes[2]);
    expect(setCrawlConfig).toHaveBeenCalledWith({ discoverSitemaps: true });
    fireEvent.click(checkboxes[3]);
    expect(setCrawlConfig).toHaveBeenCalledWith({ followNofollow: true });
    fireEvent.click(checkboxes[4]);
    expect(setCrawlConfig).toHaveBeenCalledWith({ listMode: true });

    const phraseInput = screen.getByLabelText('siteAudit.focusPhraseAria');
    fireEvent.change(phraseInput, { target: { value: 'deep search' } });
    expect(setCrawlConfig).toHaveBeenCalledWith({ focusPhrase: 'deep search' });
  });
});
