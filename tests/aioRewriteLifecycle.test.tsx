import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { AioPassageCard } from '@/components/Domain/crawlResults/aio/AioPassageCard';

const rewriteMock = vi.hoisted(() => vi.fn());
vi.mock('@/services/aioReadiness', async (original) => ({ ...(await original<typeof import('@/services/aioReadiness')>()), rewritePassage: rewriteMock }));

const passage = { url: 'https://site.test/p', heading: 'Facts', level: 2, text: 'A fact is 10 kg.', tokens: 5, windowIndex: 0, score: 20, selfContainment: 20, answerFirst: 20, triples: 0, issues: ['no-facts'] } as never;

describe('AIO rewrite lifecycle guards', () => {
  beforeEach(async () => { rewriteMock.mockReset(); await i18n.changeLanguage('en'); });

  it('ignores a late response after project/run context changes', async () => {
    let resolve!: (value: { status: 'ok'; text: string }) => void;
    rewriteMock.mockReturnValue(new Promise((done) => { resolve = done; }));
    const view = render(<AioPassageCard passage={passage} index={0} projectId="p1" runId="r1" />);
    fireEvent.click(screen.getByRole('button', { name: /Rewrite with AI/ }));
    view.rerender(<AioPassageCard passage={passage} index={0} projectId="p2" runId="r2" />);
    await act(async () => { resolve({ status: 'ok', text: 'stale draft' }); await Promise.resolve(); });
    expect(screen.queryByTestId('aio-optimized')).toBeNull();
  });

  it('marks a cancelled request and does not apply its response', async () => {
    let resolve!: (value: { status: 'ok'; text: string }) => void;
    rewriteMock.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<AioPassageCard passage={passage} index={0} projectId="p1" runId="r1" />);
    fireEvent.click(screen.getByRole('button', { name: /Rewrite with AI/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await act(async () => { resolve({ status: 'ok', text: 'late draft' }); await Promise.resolve(); });
    expect(screen.queryByTestId('aio-optimized')).toBeNull();
    expect(screen.getByText('Rewrite cancelled.')).toBeTruthy();
  });
});
