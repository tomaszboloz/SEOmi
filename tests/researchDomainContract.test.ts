import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeResearchDomain, prepareBacklinkGapDomains, ResearchDomainError } from '../mcp-server/src/contracts/researchDomain';

describe('shared research domain contract', () => {
  it.each([
    ['example.com', 'example.com'], [' HTTPS://WWW.Example.com.:8443/p?q=a#f ', 'example.com'],
    ['www.bücher.de', 'xn--bcher-kva.de'], ['http://127.0.0.1', '127.0.0.1'],
  ])('normalizes provider domain %s without performing an HTTP fetch', (value, domain) => {
    expect(normalizeResearchDomain(value)).toBe(domain);
  });

  it.each([
    ['', 'domainRequired'], ['localhost', 'domainInvalid'], ['https://[broken', 'domainInvalid'],
    ['ftp://example.com', 'domainCredentials'], ['https://user:password@example.com', 'domainCredentials'],
  ])('rejects %s with a safe error code', (value, code) => {
    let failure: unknown;
    try { normalizeResearchDomain(value); } catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(ResearchDomainError);
    expect(failure).toMatchObject({ name: 'ResearchDomainError', code });
    expect(String(failure)).not.toContain('password');
  });

  it('deduplicates and excludes the target after URL/IDN normalization', () => {
    expect(prepareBacklinkGapDomains('www.example.com', ['https://example.com./', 'www.bücher.de', 'xn--bcher-kva.de', 'other.example'])).toEqual({
      target: 'example.com', competitors: ['xn--bcher-kva.de', 'other.example'],
    });
  });

  it('enforces limits on unique competitor domains', () => {
    expect(() => prepareBacklinkGapDomains('example.com', ['www.example.com'])).toThrow('different from the target');
    const domains = Array.from({ length: 19 }, (_, i) => `c${i}.example`);
    expect(prepareBacklinkGapDomains('example.com', [...domains, ...domains]).competitors).toHaveLength(19);
    expect(() => prepareBacklinkGapDomains('example.com', [...domains, 'extra.example'])).toThrow('at most 19');
    expect(() => prepareBacklinkGapDomains('example.com', ['ftp://other.example'])).toThrow('without credentials');
  });

  it('keeps frontend and MCP wired to the same pure contract', () => {
    const frontend = readFileSync('src/services/dataforseo.ts', 'utf8');
    const mcp = readFileSync('mcp-server/src/server.ts', 'utf8');
    for (const source of [frontend, mcp]) {
      expect(source).toMatch(/import .*prepareBacklinkGapDomains.*researchDomain/);
      expect(source).toContain('prepareBacklinkGapDomains(target, competitors)');
    }
    const shared = readFileSync('mcp-server/src/contracts/researchDomain.ts', 'utf8');
    expect(shared).not.toMatch(/from ['"](?:node:|@\/|react|zod)|fetch\(/);
  });
});
