import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import {
  check,
  evidence,
  present,
  absoluteHttp,
  uniqueCount,
} from '@/services/auditChecks/auditChecksBase';

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

describe('auditChecksBase direct assertions', () => {
  it('check builds a localized LocalAuditCheck object', () => {
    const item = check('check-1', 'bezpieczenstwo', 'security-csp', 'pass', 'valid-evidence');
    expect(item.id).toBe('check-1');
    expect(item.status).toBe('pass');
    expect(item.evidence).toBe('valid-evidence');
    expect(item.category).toBeTruthy();
    expect(item.label).toBeTruthy();
  });

  it('evidence retrieves translated string with variables', () => {
    const text = evidence('notDeclared');
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });

  it('present checks string emptiness and non-null values', () => {
    expect(present('')).toBe(false);
    expect(present('   ')).toBe(false);
    expect(present('valid')).toBe(true);
    expect(present(0)).toBe(true);
    expect(present(false)).toBe(true);
    expect(present(null)).toBe(false);
    expect(present(undefined)).toBe(false);
    expect(present([])).toBe(true);
  });

  it('absoluteHttp validates HTTP and HTTPS URLs', () => {
    expect(absoluteHttp('https://example.com')).toBe(true);
    expect(absoluteHttp('http://example.com/path')).toBe(true);
    expect(absoluteHttp('ftp://example.com')).toBe(false);
    expect(absoluteHttp('/relative/path')).toBe(false);
    expect(absoluteHttp('')).toBe(false);
    expect(absoluteHttp(undefined)).toBe(false);
  });

  it('uniqueCount trims and lowercases elements before counting unique set', () => {
    expect(uniqueCount([])).toBe(0);
    expect(uniqueCount(['a', 'b', 'c'])).toBe(3);
    expect(uniqueCount(['A', 'a', ' a '])).toBe(1);
    expect(uniqueCount(['apple', 'BANANA', 'banana', ' apple '])).toBe(2);
  });
});
