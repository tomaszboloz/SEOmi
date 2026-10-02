import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { CrawlFilterPresetBar } from '@/components/Domain/crawlResults/CrawlFilterPresetBar';
import type { useCrawlResultsSession } from '@/components/Domain/crawlResults/useCrawlResultsSession';

type Session = ReturnType<typeof useCrawlResultsSession>;
const presets = [{ id: 'p1', name: 'Errors' }, { id: 'p2', name: 'Slow' }];
const session = (overrides: Record<string, unknown>) => ({
  activeProjectId: 'project', applyFilterPreset: vi.fn(), filterPresets: presets, newPresetName: '', persistFilterPresets: vi.fn(),
  saveFilterPreset: vi.fn(), selectedPresetId: '', setNewPresetName: vi.fn(), setSelectedPresetId: vi.fn(), t: (key: string) => key, ...overrides,
}) as unknown as Session;

it('applies, names and saves project filter presets only when a name and project exist', () => {
  const value = session({});
  const view = render(<CrawlFilterPresetBar session={value} />);
  fireEvent.change(screen.getByRole('combobox', { name: 'crawl.ui.savedProjectFilters' }), { target: { value: 'p2' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'crawl.ui.savedFilterName' }), { target: { value: 'Mine' } });
  expect(value.applyFilterPreset).toHaveBeenCalledExactlyOnceWith('p2');
  expect(value.setNewPresetName).toHaveBeenCalledExactlyOnceWith('Mine');
  expect((screen.getByRole('button', { name: 'crawl.ui.saveFilter' }) as HTMLButtonElement).disabled).toBe(true);
  view.rerender(<CrawlFilterPresetBar session={session({ newPresetName: 'Mine', saveFilterPreset: value.saveFilterPreset })} />);
  fireEvent.click(screen.getByRole('button', { name: 'crawl.ui.saveFilter' }));
  expect(value.saveFilterPreset).toHaveBeenCalledOnce();
  expect(screen.queryByRole('button', { name: 'crawl.ui.removeFilter' })).toBeNull();
});

it('removes only the selected preset and asks for a project when none is active', () => {
  const value = session({ selectedPresetId: 'p1', activeProjectId: null, newPresetName: 'Name' });
  render(<CrawlFilterPresetBar session={value} />);
  fireEvent.click(screen.getByRole('button', { name: 'crawl.ui.removeFilter' }));
  expect(value.persistFilterPresets).toHaveBeenCalledExactlyOnceWith([presets[1]]);
  expect(value.setSelectedPresetId).toHaveBeenCalledExactlyOnceWith('');
  expect((screen.getByRole('button', { name: 'crawl.ui.saveFilter' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText('crawl.ui.chooseProjectForFilters')).toBeTruthy();
});
