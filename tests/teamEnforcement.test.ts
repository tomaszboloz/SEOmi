import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

import i18n from '@/i18n';
import { downloadAuditPdf } from '@/services/export/audit';
import { downloadCrawlPdf } from '@/services/export/crawlReport';
import { verifyChain } from '@/services/team/auditLog';
import { AUDIT_STORAGE_KEY, flushAuditWrites, readAuditLog } from '@/services/team/auditStore';
import { deniedMessage, enforcePermission, requireAllowed } from '@/services/team/enforce';
import { TEAM_CONTEXT_KEY, readIdentity } from '@/services/team/identity';
import { useToolsStore } from '@/stores/toolsStore';
import { createCrawlResultFixture } from './fixtures/crawl';

const pdf = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('@/services/export/download', async (importOriginal) => ({ ...(await importOriginal<object>()), downloadPdf: pdf }));
vi.mock('@/services/tauri', () => ({
  invokeTauriCommand: vi.fn(async () => { throw new Error('crawl must not start'); }),
  isTauriEnvironment: vi.fn(() => false),
  getSecureValue: vi.fn(async () => ''),
}));

const logged = (count: number) => waitFor(() => expect(readAuditLog(localStorage)).toHaveLength(count));
const as = (role: string, actor = 'tester') => localStorage.setItem(TEAM_CONTEXT_KEY, JSON.stringify({ actor, role }));

afterEach(flushAuditWrites);

beforeEach(async () => {
  await flushAuditWrites();
  localStorage.clear();
  pdf.mockClear();
  await i18n.changeLanguage('en');
  useToolsStore.setState({ crawlError: null, isCrawling: false });
});

it('allows the default local admin and records the decision in the audit log', async () => {
  expect(readIdentity()).toEqual({ actor: 'local', role: 'admin' });
  expect(enforcePermission('run_crawl', { startUrl: 'https://a.test' })).toBe(true);
  await logged(1);
  expect(readAuditLog(localStorage)).toMatchObject([{ action: 'run_crawl', result: 'success', actor: 'local', role: 'admin', projectId: 'no-project', metadata: { startUrl: 'https://a.test' } }]);
});

it('denies a role without the permission, logs the denial and throws the localized message', async () => {
  as('content_writer');
  expect(enforcePermission('run_crawl')).toBe(false);
  await logged(1);
  expect(readAuditLog(localStorage)[0]).toMatchObject({ action: 'run_crawl', result: 'denied', role: 'content_writer' });
  expect(() => requireAllowed('execute_cms_patch')).toThrow(deniedMessage());
  expect(deniedMessage()).toBe('Your role cannot perform this action.');
  expect(() => requireAllowed('export_audit_pdf')).not.toThrow();
});

it('keeps deciding by role when the audit log is tampered or storage rejects writes', async () => {
  as('developer');
  enforcePermission('run_crawl');
  await logged(1);
  const tampered = readAuditLog(localStorage).map((entry) => ({ ...entry, actor: 'mallory' }));
  localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(tampered));
  expect(enforcePermission('run_crawl')).toBe(true);
  expect(enforcePermission('export_audit_pdf')).toBe(false);
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(readAuditLog(localStorage)).toHaveLength(1);
});

it('blocks the page-audit and crawl PDFs for roles without export_audit_pdf', async () => {
  as('developer');
  await expect(downloadAuditPdf({ final_url: 'https://a.test/', timestamp: '2026-10-24T00:00:00Z' } as never)).rejects.toThrow(deniedMessage());
  await expect(downloadCrawlPdf({ id: 'run', startUrl: 'https://a.test', result: createCrawlResultFixture() } as never)).rejects.toThrow(deniedMessage());
  expect(pdf).not.toHaveBeenCalled();
});

it('lets an allowed role export the page-audit PDF', async () => {
  as('seo_strategist');
  await downloadAuditPdf({ final_url: 'https://a.test/', timestamp: '2026-10-24T00:00:00Z', issues: [] } as never);
  expect(pdf).toHaveBeenCalledOnce();
  await logged(1);
  expect(readAuditLog(localStorage)[0]).toMatchObject({ action: 'export_audit_pdf', result: 'success', metadata: { report: 'page-audit' } });
});

it('refuses to start a crawl for a role without run_crawl and starts nothing', async () => {
  as('content_writer');
  const result = await useToolsStore.getState().startSiteCrawl('https://a.test', 5);
  expect(result).toBeNull();
  expect(useToolsStore.getState().crawlError).toBe('Your role cannot perform this action.');
  expect(useToolsStore.getState().isCrawling).toBe(false);
  await logged(1);
  expect(readAuditLog(localStorage)[0]).toMatchObject({ action: 'run_crawl', result: 'denied' });
});

it('translates the denial message in every locale', async () => {
  for (const locale of ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'zh']) {
    await i18n.changeLanguage(locale);
    expect(deniedMessage().length, locale).toBeGreaterThan(5);
    expect(deniedMessage(), locale).not.toBe('teamUi.denied');
  }
});

it('serializes concurrent decisions so the audit chain never forks', async () => {
  as('admin');
  const decisions = Array.from({ length: 8 }, (_, index) => enforcePermission('run_crawl', { index }));
  expect(decisions.every(Boolean)).toBe(true);
  await logged(8);
  const log = readAuditLog(localStorage);
  expect(log.map((entry) => entry.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  expect(await verifyChain(log)).toEqual({ ok: true });
});

it('flushAuditWrites resolves after queued writes land', async () => {
  as('admin');
  enforcePermission('run_crawl');
  await flushAuditWrites();
  expect(readAuditLog(localStorage)).toHaveLength(1);
});
