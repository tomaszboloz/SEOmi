import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { validateProjectName, validateProjectRootUrl } from '@/services/projectValidation';

const msg = (key: string) => i18n.t(`projects.validation.${key}`);
const root = (input?: string) => validateProjectRootUrl(input);

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('project name boundaries', () => {
  it('trims and accepts exactly 80 code points, rejects 81', () => {
    expect(validateProjectName('  Acme  ')).toEqual({ ok: true, value: 'Acme' });
    expect(validateProjectName('a'.repeat(80)).ok).toBe(true);
    expect(validateProjectName('a'.repeat(81))).toEqual({ ok: false, message: msg('nameTooLong') });
  });

  it('counts astral characters as one', () => {
    expect(validateProjectName('😀'.repeat(80)).ok).toBe(true);
    expect(validateProjectName('😀'.repeat(81)).ok).toBe(false);
  });

  it('rejects blank and control characters', () => {
    expect(validateProjectName('   ')).toEqual({ ok: false, message: msg('nameRequired') });
    expect(validateProjectName('a\u0000b')).toEqual({ ok: false, message: msg('nameInvalidChars') });
    expect(validateProjectName('a\u007fb').ok).toBe(false);
    expect(validateProjectName('a\tb').ok).toBe(false);
  });
});

describe('project root URL boundaries', () => {
  it('treats empty input as optional', () => {
    expect(root()).toEqual({ ok: true });
    expect(root('   ')).toEqual({ ok: true });
  });

  it('adds https, lowercases the host and drops a lone trailing slash', () => {
    expect(root('Example.COM')).toEqual({ ok: true, value: 'https://example.com' });
    expect(root('http://example.com/')).toEqual({ ok: true, value: 'http://example.com' });
    expect(root('example.com/path/')).toEqual({ ok: true, value: 'https://example.com/path' });
    expect(root('example.com:8080')).toEqual({ ok: true, value: 'https://example.com:8080' });
  });

  it('rejects over-long input', () => {
    expect(root(`a.com/${'x'.repeat(2048)}`)).toEqual({ ok: false, message: msg('rootTooLong') });
    expect(root(`a.com/${'x'.repeat(2040)}`).ok).toBe(true);
  });

  it.each(['ftp://example.com', 'file:///etc/passwd', 'javascript:alert(1)', 'mailto:a@b.c', 'data:text/html,x'])('rejects non-HTTP scheme %s', (input) => {
    expect(root(input)).toEqual({ ok: false, message: msg('httpOnly') });
  });

  it.each(['https://', 'http://exa mple.com', 'https://[::'])('rejects malformed %s', (input) => {
    expect(root(input)).toEqual({ ok: false, message: msg('invalidUrl') });
  });

  it('rejects embedded credentials', () => {
    expect(root('https://user:pw@example.com')).toEqual({ ok: false, message: msg('credentials') });
    expect(root('https://user@example.com').ok).toBe(false);
  });

  it.each([
    'localhost', 'LOCALHOST.', 'app.localhost', 'printer.local', 'db.internal', 'nas.lan', 'http://localhost:3000',
    '0.0.0.0', '10.1.2.3', '127.0.0.1', '100.64.0.1', '100.127.255.255', '169.254.1.1', '172.16.0.1', '172.31.255.255',
    '192.0.0.1', '192.0.2.1', '192.168.1.1', '198.18.0.1', '198.19.0.1', '198.51.100.7', '203.0.113.9', '224.0.0.1', '255.255.255.255',
    '[::1]', '[::]', '[fc00::1]', '[fd12::1]', '[fe80::1]', '[febf::1]', '[2001:db8::1]', '[2002::1]', '[::ffff:10.0.0.1]', '[::ffff:127.0.0.1]',
  ])('blocks private host %s', (input) => {
    expect(root(input)).toEqual({ ok: false, message: msg('privateUrl') });
  });

  it.each(['8.8.8.8', '100.63.255.255', '100.128.0.1', '172.15.0.1', '172.32.0.1', '192.169.0.1', '198.17.0.1', '223.255.255.255', '1.1.1.1', '[2606:4700::1111]', '[::ffff:8.8.8.8]', 'localhost.example.com', 'notlocal.com'])('allows public host %s', (input) => {
    expect(root(input).ok).toBe(true);
  });

  it.each(['10.1.2', '127.1', '2130706433', '0x7f.1', '[::10.0.0.1]', '[64:ff9b::a00:1]', '[::ffff:c0a8:101]'])('blocks shorthand or embedded private address %s', (input) => {
    expect(root(input)).toEqual({ ok: false, message: msg('privateUrl') });
  });

  it.each(['[::ffff:808:808]', '[64:ff9b::808:808]'])('allows embedded public address %s', (input) => {
    expect(root(input).ok).toBe(true);
  });

  it('rejects an IPv4 with too many parts as invalid', () => {
    expect(root('10.1.2.3.4')).toEqual({ ok: false, message: msg('invalidUrl') });
  });
});
