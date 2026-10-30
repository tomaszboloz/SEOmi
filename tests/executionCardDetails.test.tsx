import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExecutionCardDetails } from '@/components/Domain/crawlResults/executive/ExecutionCardDetails';
import { ExecutiveActionFeed } from '@/components/Domain/crawlResults/executive/ExecutiveActionFeed';
import i18n from '@/i18n';
import type { ExecutiveAction } from '@/services/actionFeed';
import { computeHss } from '@/services/hss';
import { readTasks } from '@/services/optimizationTasks/storage';
import { readTopicalMap } from '@/services/topicalDocument/storage';
import { useProjectStore } from '@/stores/projectStore';

vi.mock('@/services/tauri', () => ({ invokeTauriCommand: vi.fn() }));

const hss = computeHss([{ module: 'sfs', value: 70 }], 'r');
const action = (patch: Partial<ExecutiveAction>): ExecutiveAction => ({
  id: 'c1', type: 'sfs:add-terms', source: 'sfs', urls: ['https://a.pl/x'], evidence: [{ source: 'sfs', code: 'add-terms', items: ['espresso'] }],
  effort: null, moduleDelta: { module: 'sfs', value: 2 }, hssDelta: 1.2, conflicts: [], dependsOn: [], blocked: false, drillTab: 'focus', ...patch,
});
const card = () => screen.getByText(i18n.t('executive.card.title'));

beforeEach(async () => { await i18n.changeLanguage('en'); localStorage.clear(); useProjectStore.setState({ activeProjectId: 'p1' }); });

describe('Execution Card in the action feed (#124)', () => {
  it('shows four sections, plans a tracker task and opens a brief from the keyboard-reachable buttons', () => {
    const open = vi.fn();
    render(<ExecutionCardDetails action={action({})} hss={hss} projectId="p1" onOpen={open} />);
    fireEvent.click(card());
    for (const key of ['diagnosis', 'location', 'artifact', 'deployment']) expect(screen.getByRole('region', { name: i18n.t(`executive.card.${key}`) })).toBeTruthy();
    expect(screen.getByText('sfs:add-terms')).toBeTruthy();
    expect(screen.getByText(i18n.t('executive.card.kind.entities'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('executionCard.tasks.add') }));
    expect(readTasks('p1')).toMatchObject([{ kind: 'add-entities', url: 'https://a.pl/x', requiredEntities: ['espresso'], baselineScore: 70, expectedDelta: 2, priority: 'medium' }]);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('executionCard.brief.open') }));
    expect(readTopicalMap('p1').nodes[0].contentBrief.requiredEntities).toEqual(['espresso']);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('executive.card.openModule', { tab: i18n.t('crawl.tabs.focus') }) }));
    expect(open).toHaveBeenCalledWith('focus');
  });

  it('explains why a removal gets no task and a site-wide finding has no URL', () => {
    const { unmount } = render(<ExecutionCardDetails action={action({ type: 'sfs:remove-offtopic' })} hss={hss} projectId="p1" onOpen={vi.fn()} />);
    fireEvent.click(card());
    expect(screen.getByText(i18n.t('executive.card.noTask.removal'))).toBeTruthy();
    expect(screen.queryByRole('button', { name: i18n.t('executionCard.tasks.add') })).toBeNull();
    unmount();
    render(<ExecutionCardDetails action={action({ type: 'eetv:x', source: 'eetv', urls: [], evidence: [{ source: 'eetv', code: 'x' }] })} onOpen={vi.fn()} />);
    fireEvent.click(card());
    expect(screen.getByText(i18n.t('executive.card.noUrl'))).toBeTruthy();
    expect(screen.getByText(i18n.t('executive.card.noTask.no-url'))).toBeTruthy();
  });

  it('without a project keeps the card readable but offers no task button', () => {
    useProjectStore.setState({ activeProjectId: null });
    render(<ExecutiveActionFeed actions={[action({ type: 'internal-link', source: 'links', urls: ['https://a.pl/a', 'https://a.pl/b'] })]} hss={hss} onOpen={vi.fn()} />);
    const item = screen.getAllByRole('listitem')[0];
    fireEvent.click(within(item).getByText(i18n.t('executive.card.title')));
    expect(within(item).getByText(i18n.t('executive.card.kind.link'))).toBeTruthy();
    expect(within(item).queryByRole('button', { name: i18n.t('executionCard.tasks.add') })).toBeNull();
    expect(readTasks('p1')).toEqual([]);
  });

  it('has the card strings in every locale', async () => {
    for (const lng of ['pl', 'de', 'es', 'fr', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar']) {
      await i18n.changeLanguage(lng);
      expect(i18n.t('executive.card.noTask.in-module')).not.toBe('executive.card.noTask.in-module');
      expect(i18n.t('executive.card.title')).not.toBe(i18n.getFixedT('en')('executive.card.title'));
    }
  });
});
