import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { CoreTopicPanel } from '@/components/Domain/crawlResults/focus/CoreTopicPanel';
import { flushAuditWrites, readAuditLog } from '@/services/team/auditStore';
import { TEAM_CONTEXT_KEY } from '@/services/team/identity';

const coreTopic = { label: 'Insulin', terms: [{ term: 'insulin', coveragePct: 50, weight: 1 }], clusterId: 'c1' } as never;
const as = (role: string) => localStorage.setItem(TEAM_CONTEXT_KEY, JSON.stringify({ actor: 'tester', role }));
const panel = (manualTopic = '', onChange = vi.fn()) => render(<CoreTopicPanel coreTopic={coreTopic} coveragePct={50} confidence={70} manualTopic={manualTopic} onManualTopicChange={onChange} />);

beforeEach(async () => { await flushAuditWrites(); localStorage.clear(); });
afterEach(async () => { cleanup(); await flushAuditWrites(); });

it('lets roles with modify_site_focus_rules open, edit and reset the override, and logs each use', async () => {
  as('seo_strategist');
  const change = vi.fn();
  panel('', change);
  expect(screen.queryByRole('note')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Is this the wrong topic?' }));
  fireEvent.change(screen.getByLabelText('Your topic (words or phrase)'), { target: { value: 'glucose' } });
  expect(change).toHaveBeenCalledWith('glucose');
  fireEvent.click(screen.getByRole('button', { name: 'Reset to detected topic' }));
  expect(change).toHaveBeenLastCalledWith('');
  await flushAuditWrites();
  expect(readAuditLog(localStorage).map((entry) => [entry.action, entry.result])).toEqual([
    ['modify_site_focus_rules', 'success'],
    ['modify_site_focus_rules', 'success'],
  ]);
});

it('disables the override for roles without the permission and explains why', async () => {
  as('content_writer');
  panel();
  const wrong = screen.getByRole('button', { name: 'Is this the wrong topic?' }) as HTMLButtonElement;
  expect(wrong.disabled).toBe(true);
  expect(screen.getByRole('note').textContent).toBe('Your role cannot perform this action.');
  fireEvent.click(wrong);
  expect(screen.queryByLabelText('Your topic (words or phrase)')).toBeNull();
  await flushAuditWrites();
  expect(readAuditLog(localStorage)).toHaveLength(0);
});

it('keeps an existing manual topic read-only and the reset disabled for a restricted role', () => {
  as('developer');
  const change = vi.fn();
  panel('insulin', change);
  const input = screen.getByDisplayValue('insulin') as HTMLInputElement;
  expect(input.readOnly).toBe(true);
  expect((screen.getByRole('button', { name: 'Reset to detected topic' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Reset to detected topic' }));
  expect(change).not.toHaveBeenCalled();
});
