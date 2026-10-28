import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/desktopNotifications/delivery', () => ({ sendProjectNotification: vi.fn().mockResolvedValue(false) }));

import { CoreAnchorsPanel } from '@/components/Domain/crawlResults/focus/CoreAnchorsPanel';
import { useSiteFocus } from '@/hooks/useSiteFocus';
import {
  buildProjectRunReport, cleanAnchorUrls, focusAnchorsKey, parseAnchorInput, projectFocusOptions, readAnchorUrls, writeAnchorUrls, writeManualTopic,
} from '@/services/siteFocusMonitoring';
import { TEAM_CONTEXT_KEY } from '@/services/team/identity';
import { createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';
import { diabetesSite } from './siteFocusFixtures';

const HOST = 'diabetes.test';
const run = (id: string) => createCrawlRunFixture({ id, startUrl: `https://${HOST}/`, result: createCrawlResultFixture({ pages: diabetesSite(HOST) }) });
const category = `https://${HOST}/category/diabetes-care`;
const as = (role: string) => localStorage.setItem(TEAM_CONTEXT_KEY, JSON.stringify({ actor: 'tester', role }));

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('anchor page settings', () => {
  it('keeps only trimmed, unique http(s) URLs within the engine caps', () => {
    expect(cleanAnchorUrls('x')).toEqual([]);
    expect(cleanAnchorUrls([' https://a.test/x ', 'https://a.test/x', 'ftp://a.test', 'not a url', 7, `https://a.test/${'y'.repeat(2048)}`])).toEqual(['https://a.test/x']);
    expect(cleanAnchorUrls(Array.from({ length: 25 }, (_, i) => `https://a.test/${i}`))).toHaveLength(20);
    expect(parseAnchorInput('https://a.test/1\n\nhttps://a.test/2, https://a.test/3')).toEqual(['https://a.test/1', 'https://a.test/2', 'https://a.test/3']);
  });

  it('persists per project, clears on empty input and ignores invalid projects', () => {
    expect(writeAnchorUrls('p1', ['https://a.test/x'])).toBe(true);
    expect(readAnchorUrls('p1')).toEqual(['https://a.test/x']);
    expect(readAnchorUrls('p2')).toEqual([]);
    writeAnchorUrls('p1', []);
    expect(localStorage.getItem(focusAnchorsKey('p1'))).toBeNull();
    expect(writeAnchorUrls('../bad', ['https://a.test/x'])).toBe(false);
    expect(readAnchorUrls(null)).toEqual([]);
  });

  it('gives every SFS consumer the same saved topic inputs', () => {
    expect(projectFocusOptions('p1')).toEqual({ manualTopic: undefined });
    writeAnchorUrls('p1', [category]);
    writeManualTopic('p1', 'insulin');
    expect(projectFocusOptions('p1')).toEqual({ manualTopic: 'insulin', anchorUrls: [category] });
    writeManualTopic('p1', null);
    const report = buildProjectRunReport(run('r1'), 'p1', '2026-10-01T00:00:00Z');
    expect(report.coreTopic.mode).toBe('anchored');
    expect(report.coreTopic.anchors?.sources).toContain(category);
  });

  it('hook saves anchors, rebuilds the report and reloads them on project switch', () => {
    const { result, rerender } = renderHook(({ p }) => useSiteFocus(run('r1'), p), { initialProps: { p: 'p1' } });
    expect(result.current.anchorUrls).toEqual([]);
    expect(result.current.report?.coreTopic.mode).toBe('auto');
    act(() => result.current.setAnchorUrls([category, `https://${HOST}/missing`]));
    expect(result.current.anchorUrls).toEqual([category, `https://${HOST}/missing`]);
    expect(result.current.report?.coreTopic.mode).toBe('anchored');
    expect(result.current.report?.coreTopic.anchors?.missing).toEqual([`https://${HOST}/missing`]);
    rerender({ p: 'p2' });
    expect(result.current.anchorUrls).toEqual([]);
  });
});

describe('CoreAnchorsPanel', () => {
  const topic = (patch = {}) => ({ label: 'Diabetes', terms: [], clusterId: 'c1', ...patch }) as never;

  it('shows the mode, applied sources and missing anchors and reports edits', () => {
    as('seo_strategist');
    const change = vi.fn();
    render(<CoreAnchorsPanel coreTopic={topic({ mode: 'anchored', anchors: { sources: ['https://a.test/', 'https://a.test/x'], missing: ['https://a.test/gone'], applied: true } })} value="https://a.test/x" onChange={change} />);
    expect(screen.getByTestId('focus-core-mode').textContent).toBe('Topic mode: home page and anchor pages');
    expect(screen.getByText('Pages used to pick the topic: 2')).toBeTruthy();
    expect(screen.getByText('https://a.test/gone')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Anchor pages (one URL per line)'), { target: { value: 'https://a.test/y' } });
    expect(change).toHaveBeenCalledWith('https://a.test/y');
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('says a manual topic wins and defaults to auto mode', () => {
    as('seo_strategist');
    const { rerender } = render(<CoreAnchorsPanel coreTopic={topic({ mode: 'manual' })} value="https://a.test/x" onChange={vi.fn()} />);
    expect(screen.getByText('Your manual topic takes precedence over anchor pages.')).toBeTruthy();
    rerender(<CoreAnchorsPanel coreTopic={topic()} value="" onChange={vi.fn()} />);
    expect(screen.getByTestId('focus-core-mode').textContent).toBe('Topic mode: detected from all content');
  });

  it('is read-only for roles without modify_site_focus_rules', () => {
    as('content_writer');
    render(<CoreAnchorsPanel coreTopic={topic()} value="" onChange={vi.fn()} />);
    expect((screen.getByLabelText('Anchor pages (one URL per line)') as HTMLTextAreaElement).readOnly).toBe(true);
    expect(screen.getByRole('note').textContent).toBe('Your role cannot perform this action.');
  });
});
