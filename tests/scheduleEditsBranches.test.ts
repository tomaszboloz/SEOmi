import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { addScheduledAudit, loadScheduledAudits, removeScheduledAudit, runScheduledAuditNow, setScheduledAuditEnabled } from '@/services/auditSchedule';
import { saveScheduledAudits } from '@/services/schedules/persistence';
import { MAX_SCHEDULES_PER_PROJECT } from '@/services/schedules/policy';

const NOW = Date.UTC(2026, 0, 1);
const err = (key: string, o?: Record<string, unknown>) => i18n.t(`runtimeErrors.schedules.${key}`, o);
const add = (url: string, extra: object = {}, project = 'proj') => addScheduledAudit(project, url, 24, NOW, extra);

describe('schedule edits', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); localStorage.clear(); });

  describe('addScheduledAudit validation', () => {
    it.each([
      ['no project', () => addScheduledAudit('', 'https://a.test/', 24, NOW), () => err('projectCreateRequired')],
      ['bad interval', () => addScheduledAudit('proj', 'https://a.test/', 5 as never, NOW), () => err('intervalInvalid')],
      ['too long', () => add(`https://a.test/${'x'.repeat(2100)}`), () => err('urlTooLong')],
      ['unparsable', () => add('not a url'), () => err('urlInvalid')],
      ['non-http', () => add('ftp://a.test/'), () => err('urlPublicOnly')],
      ['credentials', () => add('https://user:pw@a.test/'), () => err('urlPublicOnly')],
      ['crawl limit zero', () => add('https://a.test/', { taskType: 'site-crawl', crawlLimit: 0 }), () => err('crawlLimit')],
      ['crawl limit too big', () => add('https://a.test/', { taskType: 'site-crawl', crawlLimit: 501 }), () => err('crawlLimit')],
      ['crawl limit NaN', () => add('https://a.test/', { taskType: 'site-crawl', crawlLimit: Number.NaN }), () => err('crawlLimit')],
    ])('rejects %s', (_name, run, message) => {
      expect(run).toThrow(message());
      expect(loadScheduledAudits('proj')).toEqual([]);
    });

    it('rejects duplicates by normalized url and enforces the per-project cap', () => {
      add('https://a.test');
      expect(() => add(' https://a.test/ ')).toThrow(err('duplicate'));
      const filler = Array.from({ length: MAX_SCHEDULES_PER_PROJECT - 1 }, (_, i) => ({ ...loadScheduledAudits('proj')[0], id: `f${i}`, url: `https://f${i}.test/` }));
      saveScheduledAudits('proj', [...loadScheduledAudits('proj'), ...filler]);
      expect(() => add('https://new.test/')).toThrow(err('maxReached', { count: MAX_SCHEDULES_PER_PROJECT }));
    });
  });

  describe('addScheduledAudit creation', () => {
    it('creates a page audit that ignores crawl options', () => {
      const s = add('https://a.test/p', { crawlLimit: 9999, crawlConfig: { maxDepth: 2 } });
      expect(s).toMatchObject({ taskType: 'page-audit', enabled: true, status: 'scheduled', createdAt: new Date(NOW).toISOString(), nextRunAt: new Date(NOW + 24 * 3600 * 1000).toISOString() });
      expect(s).not.toHaveProperty('crawlLimit');
      expect(loadScheduledAudits('proj')[0].id).toBe(s.id);
    });

    it('creates a crawl schedule with a deep-copied config and default limit', () => {
      const config = { maxDepth: 3, includePatterns: ['/a'] };
      const s = add('https://a.test/', { taskType: 'site-crawl', crawlConfig: config });
      expect(s.crawlLimit).toBe(25);
      expect(s.crawlConfig).toEqual(config);
      expect(s.crawlConfig).not.toBe(config);
      expect(add('https://b.test/', { taskType: 'site-crawl', crawlLimit: 12.9 }).crawlLimit).toBe(12);
      expect(add('https://c.test/', { taskType: 'site-crawl' }).crawlConfig).toBeUndefined();
    });

    it('puts the newest schedule first', () => {
      add('https://a.test/'); add('https://b.test/');
      expect(loadScheduledAudits('proj').map((s) => s.url)).toEqual(['https://b.test/', 'https://a.test/']);
    });
  });

  describe('state transitions', () => {
    it('pauses, resumes with a fresh next run and clears the last error', () => {
      const s = add('https://a.test/');
      saveScheduledAudits('proj', [{ ...s, lastError: 'old' }]);
      const paused = setScheduledAuditEnabled('proj', s.id, false, NOW + 1000);
      expect(paused[0]).toMatchObject({ enabled: false, status: 'paused', nextRunAt: s.nextRunAt, lastError: undefined });
      const resumed = setScheduledAuditEnabled('proj', s.id, true, NOW + 5000);
      expect(resumed[0]).toMatchObject({ enabled: true, status: 'scheduled', nextRunAt: new Date(NOW + 5000 + 24 * 3600 * 1000).toISOString() });
    });

    it('leaves other schedules untouched when toggling an unknown id', () => {
      add('https://a.test/');
      const before = loadScheduledAudits('proj');
      expect(setScheduledAuditEnabled('proj', 'missing', false)).toEqual(before);
    });

    it('makes an enabled idle schedule due now but skips paused, running and other ids', () => {
      const a = add('https://a.test/'); const b = add('https://b.test/'); const c = add('https://c.test/');
      saveScheduledAudits('proj', [{ ...c, enabled: false, status: 'paused' }, { ...b, status: 'running', lastError: 'e' }, { ...a, lastError: 'boom' }]);
      expect(runScheduledAuditNow('proj', a.id, NOW + 77)[2]).toMatchObject({ status: 'scheduled', nextRunAt: new Date(NOW + 77).toISOString(), lastError: undefined });
      const before = loadScheduledAudits('proj');
      expect(runScheduledAuditNow('proj', c.id, NOW + 99)[0]).toEqual(before[0]);
      expect(runScheduledAuditNow('proj', b.id, NOW + 99)[1]).toEqual(before[1]);
      expect(runScheduledAuditNow('proj', 'missing', NOW)).toEqual(loadScheduledAudits('proj'));
    });

    it('removes only the matching schedule', () => {
      const a = add('https://a.test/'); const b = add('https://b.test/');
      expect(removeScheduledAudit('proj', a.id).map((s) => s.id)).toEqual([b.id]);
      expect(loadScheduledAudits('proj').map((s) => s.id)).toEqual([b.id]);
      expect(removeScheduledAudit('proj', 'missing')).toHaveLength(1);
    });
  });
});
