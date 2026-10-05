import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { CrawlArchitectureControls } from '@/components/Charts/crawlArchitecture/CrawlArchitectureControls';
import type { SemanticMapPreferences } from '@/components/Charts/crawlArchitecture/CrawlArchitectureTypes';

const graph = { clusters: [{ id: 'c1', label: 'Blog', pageCount: 4 }, { id: 'c2', label: 'Shop', pageCount: 9 }] };
const start = { query: '', clusterFilter: 'all', orphansOnly: false, linkMode: 'content' } as SemanticMapPreferences;
const scaleView = vi.fn();
const resetView = vi.fn();
let latest: SemanticMapPreferences = start;

const Harness = () => {
  const [preferences, setPreferences] = useState(start);
  latest = preferences;
  return <CrawlArchitectureControls preferences={preferences} setPreferences={setPreferences} graph={graph} scaleView={scaleView} resetView={resetView} />;
};

beforeEach(async () => {
  await i18n.changeLanguage('en');
  scaleView.mockReset();
  resetView.mockReset();
  latest = start;
  render(<Harness />);
});

describe('CrawlArchitectureControls', () => {
  it('toggles the link scope and reflects it in aria-pressed', () => {
    const content = screen.getByRole('button', { name: i18n.t('mapUi.contentOnly') });
    const all = screen.getByRole('button', { name: i18n.t('mapUi.allLinks') });
    expect([content.getAttribute('aria-pressed'), all.getAttribute('aria-pressed')]).toEqual(['true', 'false']);
    fireEvent.click(all);
    expect(latest.linkMode).toBe('all');
    expect([content.getAttribute('aria-pressed'), all.getAttribute('aria-pressed')]).toEqual(['false', 'true']);
    fireEvent.click(content);
    expect(latest.linkMode).toBe('content');
  });

  it('updates the search query', () => {
    fireEvent.change(screen.getByLabelText(i18n.t('mapUi.searchAria')), { target: { value: 'pricing' } });
    expect(latest.query).toBe('pricing');
    expect((screen.getByLabelText(i18n.t('mapUi.searchAria')) as HTMLInputElement).value).toBe('pricing');
  });

  it('lists clusters with counts and filters by the chosen one', () => {
    const select = screen.getByLabelText(i18n.t('mapUi.clusterAria')) as HTMLSelectElement;
    expect([...select.options].map((o) => o.text)).toEqual([i18n.t('mapUi.allClusters', { count: 2 }), 'Blog · 4', 'Shop · 9']);
    fireEvent.change(select, { target: { value: 'c2' } });
    expect(latest.clusterFilter).toBe('c2');
  });

  it('toggles orphans only without touching other preferences', () => {
    fireEvent.click(screen.getByLabelText(i18n.t('mapUi.orphansOnly')));
    expect(latest).toEqual({ ...start, orphansOnly: true });
  });

  it('zooms in, out by the reciprocal factor, and resets', () => {
    fireEvent.click(screen.getByRole('button', { name: i18n.t('mapUi.zoomIn') }));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('mapUi.zoomOut') }));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('mapUi.resetZoom') }));
    expect(scaleView.mock.calls).toEqual([[1.2], [1 / 1.2]]);
    expect(resetView).toHaveBeenCalledTimes(1);
  });
});
