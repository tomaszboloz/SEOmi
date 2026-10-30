import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/desktopNotifications/delivery', () => ({ sendProjectNotification: vi.fn().mockResolvedValue(false) }));

import { BusinessGoalPanel } from '@/components/Domain/crawlResults/focus/BusinessGoalPanel';
import { useSiteFocus } from '@/hooks/useSiteFocus';
import { checkBusinessGoal } from '@/services/siteFocus';
import { TEAM_CONTEXT_KEY } from '@/services/team/identity';
import { createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';
import { diabetesSite } from './siteFocusFixtures';

const as = (role: string) => localStorage.setItem(TEAM_CONTEXT_KEY, JSON.stringify({ actor: 'tester', role }));
const topic = (patch = {}) => ({ label: 'Diabetes', terms: [], clusterId: 'c1', mode: 'auto', ...patch }) as never;
const status = () => screen.getByTestId('focus-goal-status').textContent;

beforeEach(() => { localStorage.clear(); as('seo_strategist'); });
afterEach(cleanup);

describe('BusinessGoalPanel', () => {
  it('validates before saving and shows the error instead of storing bad input', () => {
    const save = vi.fn(checkBusinessGoal);
    render(<BusinessGoalPanel coreTopic={topic()} saved={undefined} persisted onSave={save} />);
    expect(status()).toBe('No business goal set.');
    fireEvent.change(screen.getByLabelText('What should this site sell or achieve? (one sentence)'), { target: { value: 'https://x.test/' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save goal' }));
    expect(screen.getByRole('alert').textContent).toBe('This looks like a URL. Add pages in the anchor pages field instead.');
    fireEvent.change(screen.getByLabelText('What should this site sell or achieve? (one sentence)'), { target: { value: 'insulin pumps' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save goal' }));
    expect(save).toHaveBeenLastCalledWith('insulin pumps');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('explains applied, unmatched and overridden goals honestly', () => {
    const goal = (matched: boolean, applied: boolean) => ({ input: 'insulin pumps', matched, applied });
    const { rerender } = render(<BusinessGoalPanel coreTopic={topic({ mode: 'goal', businessGoal: goal(true, true) })} saved="insulin pumps" persisted onSave={checkBusinessGoal} />);
    expect(status()).toBe('Business goal picked the core topic: insulin pumps');
    rerender(<BusinessGoalPanel coreTopic={topic({ businessGoal: goal(false, false) })} saved="insulin pumps" persisted onSave={checkBusinessGoal} />);
    expect(status()).toContain('detected from all content instead');
    rerender(<BusinessGoalPanel coreTopic={topic({ mode: 'anchored', businessGoal: goal(false, false) })} saved="insulin pumps" persisted onSave={checkBusinessGoal} />);
    expect(status()).toContain('home page and anchor pages instead');
    rerender(<BusinessGoalPanel coreTopic={topic({ mode: 'manual', businessGoal: goal(true, false) })} saved="insulin pumps" persisted onSave={checkBusinessGoal} />);
    expect(status()).toBe('Your manual topic takes precedence over the business goal.');
  });

  it('is read-only without a project or without permission', () => {
    const save = vi.fn(checkBusinessGoal);
    const { unmount } = render(<BusinessGoalPanel coreTopic={topic()} saved={undefined} persisted={false} onSave={save} />);
    expect(screen.getByText('Business goals are saved per project. Open this crawl from a project to set one.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save goal' }) as HTMLButtonElement).disabled).toBe(true);
    unmount();
    as('content_writer');
    render(<BusinessGoalPanel coreTopic={topic()} saved={undefined} persisted onSave={save} />);
    expect(screen.getAllByRole('note').length).toBeGreaterThan(0);
    expect(save).not.toHaveBeenCalled();
  });
});

describe('useSiteFocus business goal', () => {
  it('saves a valid goal per project, rebuilds the report with it and keeps it per project', () => {
    const run = createCrawlRunFixture({ id: 'r1', startUrl: 'https://diabetes.test/', result: createCrawlResultFixture({ pages: diabetesSite('diabetes.test') }) });
    const { result, rerender } = renderHook(({ p }) => useSiteFocus(run, p), { initialProps: { p: 'p1' } });
    expect(result.current.businessGoal).toBeUndefined();
    let outcome: ReturnType<typeof result.current.setBusinessGoal> | undefined;
    act(() => { outcome = result.current.setBusinessGoal('x'); });
    expect(outcome).toEqual({ ok: false, error: 'too-short' });
    act(() => { outcome = result.current.setBusinessGoal('insulin therapy'); });
    expect(outcome?.ok).toBe(true);
    expect(result.current.businessGoal).toBe('insulin therapy');
    expect(result.current.report?.coreTopic.businessGoal?.input).toBe('insulin therapy');
    rerender({ p: 'p2' });
    expect(result.current.businessGoal).toBeUndefined();
  });
});
