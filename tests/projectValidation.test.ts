import { describe, expect, it } from 'vitest';
import { validateProjectName, validateProjectRootUrl } from '@/services/projectValidation';
import { normalizePersistedProjects } from '@/stores/projectStore';
import i18n from '@/i18n';

describe('project root URL validation', () => {
  it('allows an empty optional value', () => {
    expect(validateProjectRootUrl('   ')).toEqual({ ok: true });
  });

  it('accepts HTTP(S) and adds https to a scheme-less host', () => {
    expect(validateProjectRootUrl('https://Example.com/')).toEqual({ ok: true, value: 'https://example.com' });
    expect(validateProjectRootUrl('example.com')).toEqual({ ok: true, value: 'https://example.com' });
  });

  it('rejects unsupported schemes and credentials', () => {
    expect(validateProjectRootUrl('mailto:owner@example.com')).toMatchObject({ ok: false });
    expect(validateProjectRootUrl('https://user:secret@example.com')).toEqual({
      ok: false,
      message: i18n.t('projects.validation.credentials'),
    });
  });

  it('rejects local, private, and documentation hosts', () => {
    for (const value of ['http://localhost:3000', 'http://10.0.0.5', 'http://192.168.1.10', 'http://[::1]', 'https://example.local']) {
      expect(validateProjectRootUrl(value)).toMatchObject({ ok: false, message: i18n.t('projects.validation.privateUrl') });
    }
  });

  it('keeps a public path and query usable as a crawl root', () => {
    expect(validateProjectRootUrl('https://example.com/store?page=1')).toEqual({ ok: true, value: 'https://example.com/store?page=1' });
  });

  it('handles IPv4-mapped IPv6 addresses for both private and public destinations', () => {
    expect(validateProjectRootUrl('http://[::ffff:192.168.1.1]')).toMatchObject({ ok: false });
    expect(validateProjectRootUrl('http://[::ffff:8.8.8.8]')).toMatchObject({ ok: true, value: 'http://[::ffff:808:808]' });
  });
});

describe('project name validation', () => {
  it('trims and accepts a normal name', () => {
    expect(validateProjectName('  Sklep główny  ')).toEqual({ ok: true, value: 'Sklep główny' });
  });

  it('enforces the store-level name and control-character limits', () => {
    expect(validateProjectName('')).toMatchObject({ ok: false });
    expect(validateProjectName('x'.repeat(81))).toEqual({ ok: false, message: i18n.t('projects.validation.nameTooLong') });
    expect(validateProjectName('Sklep\u0000')).toEqual({ ok: false, message: i18n.t('projects.validation.nameInvalidChars') });
  });

  it('enforces the store-level root URL length limit', () => {
    expect(validateProjectRootUrl(`https://${'a'.repeat(2042)}.com`)).toEqual({ ok: false, message: i18n.t('projects.validation.rootTooLong') });
  });

  it('drops malformed, private, duplicate and invalid-date persisted projects', () => {
    const projects = normalizePersistedProjects([
      { id: 'valid', name: '  Valid  ', rootUrl: 'example.com', createdAt: 'not-a-date', lastOpenedAt: '2026-09-24T00:00:00Z' },
      { id: 'valid', name: 'Duplicate', rootUrl: 'https://example.com' },
      { id: 'private', name: 'Private', rootUrl: 'http://127.0.0.1:1420' },
      { id: 'missing-name', name: '', rootUrl: 'https://example.com' },
      'not-an-object',
    ], '2026-09-24T12:00:00.000Z');

    expect(projects).toEqual([{
      id: 'valid',
      name: 'Valid',
      rootUrl: 'https://example.com',
      createdAt: '2026-09-24T12:00:00.000Z',
      lastOpenedAt: '2026-09-24T00:00:00.000Z',
    }]);
  });
});
