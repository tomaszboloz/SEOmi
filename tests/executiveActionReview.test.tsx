import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExecutiveActionFeed } from '@/components/Domain/crawlResults/executive/ExecutiveActionFeed';
import i18n from '@/i18n';
import { readDecisionLog, type ExecutiveAction } from '@/services/actionFeed';
import { computeHss } from '@/services/hss';
import { readTasks } from '@/services/optimizationTasks/storage';

const hss = computeHss([{ module: 'sfs', value: 80 }, { module: 'tas', value: 60 }, { module: 'sprs', value: 40 }], 'r1');
const base: ExecutiveAction = {
  id: 'act-1', type: 'internal-link', source: 'sfs', urls: ['https://a.pl/x', 'https://a.pl/hub'], evidence: [{ source: 'sfs', code: 'link', params: {} }],
  effort: null, moduleDelta: { module: 'sfs', value: 2 }, hssDelta: null, conflicts: [], dependsOn: [], blocked: false, drillTab: 'visualisations',
};
const tas: ExecutiveAction = { ...base, id: 'act-2', type: 'tas:merge-cannibalized', source: 'tas', urls: ['https://a.pl/m'], moduleDelta: null, drillTab: 'authority' };

beforeEach(async () => { await i18n.changeLanguage('en'); localStorage.clear(); });

describe('action feed review (#89 GEM-89-08)', () => {
  it('records accept / defer / reject with aria-pressed and a dated history', () => {
    render(<ExecutiveActionFeed actions={[base, tas]} onOpen={vi.fn()} projectId="p1" hss={hss} />);
    const item = within(screen.getAllByRole('listitem')[0]);
    fireEvent.click(item.getByRole('button', { name: 'Defer' }));
    fireEvent.click(item.getByRole('button', { name: 'Accept' }));
    expect(item.getByRole('button', { name: 'Accept' }).getAttribute('aria-pressed')).toBe('true');
    expect(item.getByRole('button', { name: 'Defer' }).getAttribute('aria-pressed')).toBe('false');
    expect(item.getByText(/^Decision: Accept .* 2 in history$/)).toBeTruthy();
    expect(readDecisionLog('p1').map((row) => [row.decision, row.runId])).toEqual([['deferred', 'r1'], ['accepted', 'r1']]);
  });

  it('hands link actions to the task tracker with the module baseline; other actions get no tracker button', () => {
    render(<ExecutiveActionFeed actions={[base, tas]} onOpen={vi.fn()} projectId="p1" hss={hss} />);
    const [link, merge] = screen.getAllByRole('listitem');
    expect(within(merge).queryByRole('button', { name: 'Add to tracker' })).toBeNull();
    fireEvent.click(within(link).getByRole('button', { name: 'Add to tracker' }));
    expect(readTasks('p1')[0]).toMatchObject({ kind: 'add-link', module: 'sfs', url: 'https://a.pl/x', targetUrl: 'https://a.pl/hub', baselineScore: 80 });
  });

  it('uses SPRS for link actions without a tracked module delta and hides review without a project', () => {
    const { unmount } = render(<ExecutiveActionFeed actions={[{ ...base, moduleDelta: null, source: 'links' }]} onOpen={vi.fn()} projectId="p1" hss={hss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to tracker' }));
    expect(readTasks('p1')[0]).toMatchObject({ module: 'sprs', baselineScore: 40 });
    unmount();
    render(<ExecutiveActionFeed actions={[base]} onOpen={vi.fn()} />);
    expect(screen.queryByRole('group', { name: 'Review decision' })).toBeNull();
  });
});
