import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { OutreachTargetsPanel } from '@/components/Domain/OutreachTargetsPanel';

const copyText = vi.hoisted(() => vi.fn());
vi.mock('@/services/clipboard', () => ({ copyText }));

const target = { domain: 'blog.com', linkingCompetitors: ['a.com', 'b.com'], relevance: 0.66, authority: 0.7, priority: 0.462 };
const evidence = {
  reportId: 'igos:https://me.com/study:2:1:1',
  sourceUrl: 'https://me.com/study',
  novelEntities: ['evidence-entity'],
  gainZones: 1,
  baselineDocs: 2,
  baselineProvenance: 'igos' as const,
};

describe('OutreachTargetsPanel', () => {
  beforeEach(() => copyText.mockReset().mockResolvedValue(true));
  it('shows an empty state without export', () => {
    render(<OutreachTargetsPanel targets={[]} onExport={vi.fn()} />);
    expect(screen.getByTestId('outreach-panel').textContent).toContain('No backlink gap data');
    expect(screen.queryByRole('button', { name: 'Export CSV' })).toBeNull();
  });

  it('lists targets and exports on demand', () => {
    const onExport = vi.fn();
    render(<OutreachTargetsPanel targets={[target]} onExport={onExport} />);
    expect(screen.getByText('blog.com: priority 0.46, links to 2 competitors')).toBeTruthy();
    expect(screen.getByText(/never sends messages/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(onExport).toHaveBeenCalledWith([target]);
  });

  it('attaches a verified IGOS source, switches targets and copies only the draft', async () => {
    const second = { ...target, domain: 'news.com', priority: 0.3 };
    const source = { title: 'Original study', url: 'https://me.com/study', summary: 'Fresh evidence.', provenance: 'igos' as const, evidence };
    const secondSource = { ...source, title: 'Dataset', url: 'https://me.com/data', evidence: { ...evidence, sourceUrl: 'https://me.com/data' } };
    render(<OutreachTargetsPanel targets={[target, second]} onExport={vi.fn()} site="me.com" source={source} sourceStatus="ready" sources={[source, secondSource]} />);
    expect(screen.getByTestId('outreach-draft').textContent).toContain('Original study');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'https://me.com/data' } });
    expect(screen.getByTestId('outreach-draft').textContent).toContain('Dataset');
    fireEvent.click(screen.getByRole('button', { name: /news\.com: priority/ }));
    expect(screen.getByTestId('outreach-draft').textContent).toContain('news.com');
    fireEvent.click(screen.getByRole('button', { name: 'Copy draft' }));
    await waitFor(() => expect(copyText).toHaveBeenCalledWith(expect.stringContaining('Fresh evidence.')));
    expect(screen.queryByRole('button', { name: /send/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /mailto/i })).toBeNull();
  });

  it('reports a missing source without offering a draft', () => {
    render(<OutreachTargetsPanel targets={[target]} onExport={vi.fn()} site="me.com" sourceStatus="ready" />);
    expect(screen.getByTestId('outreach-source-status').textContent).toContain('Attach a real');
    expect(screen.queryByTestId('outreach-draft')).toBeNull();
  });

  it('shows partial availability and reports clipboard failure without a send action', async () => {
    copyText.mockResolvedValue(false);
    const source = { title: 'Study', url: 'https://me.com/study', summary: 'Evidence.', provenance: 'igos' as const, evidence };
    const view = render(<OutreachTargetsPanel targets={[target]} onExport={vi.fn()} site="me.com" source={source} sourceStatus="partial" />);
    expect(screen.getByRole('alert').textContent).toContain('IGOS is partial');
    fireEvent.click(screen.getByRole('button', { name: 'Copy draft' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Copy failed'));
    view.unmount();
    render(<OutreachTargetsPanel targets={[target]} onExport={vi.fn()} sourceStatus="partial" />);
    expect(screen.getByTestId('outreach-source-status').textContent).toContain('IGOS is partial');
  });
});
