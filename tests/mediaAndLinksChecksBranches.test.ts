import { describe, expect, it } from 'vitest';
import { buildLinksChecks, buildMediaChecks } from '@/services/auditChecks/mediaAndLinksChecks';
import { audit } from './fixtures/auditChecksContracts';
import type { PageAuditData } from '@/types';

const statuses = (items: { id: string; status: string }[]) => Object.fromEntries(items.map((i) => [i.id, i.status]));
const img = (o: object = {}) => ({ src: 'https://cdn.test/a.webp', has_alt: true, alt: 'alt', width: 10, height: 10, loading: 'lazy', srcset: 'a 1x', format: 'webp', ...o });
const media = (images: object[], extra: Partial<PageAuditData> = {}) => statuses(buildMediaChecks(audit({ images: images as never, ...extra })));
const linkBlock = (links: object[], o: object = {}) => ({ total_links: links.length, internal_links: links.length, external_links: 0, nofollow_links: 0, links, ...o }) as never;
const lnk = (o: object = {}) => ({ href: 'https://example.com/x', text: 'x', is_internal: true, is_insecure: false, ...o });
const links = (block: unknown, extra: Partial<PageAuditData> = {}) => statuses(buildLinksChecks(audit({ links: block as never, ...extra })));

describe('buildMediaChecks', () => {
  it('marks image checks not applicable when there are no images', () => {
    const s = media([]);
    expect(s['images-alt']).toBe('not_applicable');
    expect(s['images-insecure']).toBe('not_applicable');
    expect(s['images-duplicate-src']).toBe('pass');
    expect(s['images-data-uri']).toBe('pass');
  });
  it('passes for a clean lazy, responsive, modern image set', () => {
    const s = media([img()]);
    expect(Object.values(s).every((v) => v === 'pass')).toBe(true);
  });
  it('warns for missing alt, empty alt, dimensions and loading hints', () => {
    const s = media([img({ has_alt: false, alt: undefined, width: undefined, loading: undefined, srcset: undefined, format: undefined, src: 'rel/x.png' }), img({ alt: '  ', height: undefined, src: 'https://cdn.test/b.png', loading: 'eager', srcset: undefined })]);
    for (const id of ['images-alt', 'images-alt-nonempty', 'images-dimensions', 'images-dimensions-pair', 'images-loading', 'images-srcset', 'images-modern-format', 'images-absolute', 'images-format-known']) expect(s[id], id).toBe('warning');
  });
  it('detects duplicates, data URIs beyond ten and mixed content over https', () => {
    const dup = media([img(), img()]);
    expect(dup['images-duplicate-src']).toBe('warning');
    const many = media(Array.from({ length: 11 }, (_, i) => img({ src: `data:image/png;base64,${i}` })));
    expect(many['images-data-uri']).toBe('warning');
    expect(many['images-absolute']).toBe('pass');
    expect(media([img({ src: 'http://cdn.test/a.webp' })])['images-insecure']).toBe('error');
    expect(media([img()])['images-insecure']).toBe('pass');
    expect(media([img({ src: 'http://cdn.test/a.webp' })], { final_url: undefined as never, url: 'http://example.com' })['images-insecure']).toBe('not_applicable');
  });
  it('accepts root-relative sources and uses src extension when format is absent', () => {
    const s = media([img({ src: '/img/a.avif', format: undefined })]);
    expect(s['images-absolute']).toBe('pass');
    expect(s['images-modern-format']).toBe('pass');
  });
});

describe('buildLinksChecks', () => {
  it('handles a missing links block as an empty set', () => {
    const s = links(undefined);
    expect(s['links-total-consistent']).toBe('pass');
    expect(s['links-empty-anchor']).toBe('not_applicable');
    expect(s['links-internal-count']).toBe('not_applicable');
    expect(s['links-external-count']).toBe('not_applicable');
    expect(s['links-insecure']).toBe('not_applicable');
  });
  it('passes for consistent, secure, labelled links and notes external presence', () => {
    const s = links(linkBlock([lnk(), lnk({ href: 'https://other.test/', is_internal: false })], { internal_links: 1, external_links: 1 }));
    expect(Object.values(s).every((v) => v === 'pass')).toBe(true);
  });
  it('flags inconsistent counters', () => {
    const s = links(linkBlock([lnk()], { total_links: 3, internal_links: 1, external_links: 0, nofollow_links: 5 }));
    expect(s['links-total-consistent']).toBe('warning');
    expect(s['links-internal-external']).toBe('warning');
    expect(s['links-nofollow-bounded']).toBe('error');
  });
  it('flags empty anchors, insecure, duplicate and unsafe blank-target links', () => {
    const s = links(linkBlock([lnk({ text: ' ', href: 'http://a.test/', target: '_blank', rel: 'nofollow' }), lnk({ is_insecure: true, href: 'https://a.test/dup', target: '_blank', rel: 'noopener' }), lnk({ href: 'https://a.test/dup' })]));
    for (const id of ['links-empty-anchor', 'links-insecure', 'links-duplicate', 'links-target-blank', 'links-anchor-coverage']) expect(s[id], id).toBe('warning');
    expect(links(linkBlock([lnk({ href: 'http://a.test/' })]), { final_url: 'http://example.com' })['links-insecure']).toBe('not_applicable');
  });
  it('errors on missing href or non-string rel and warns when nothing is internal', () => {
    const s = links(linkBlock([lnk({ href: '', rel: 5 })], { internal_links: 0, external_links: 1 }));
    expect(s['links-href-present']).toBe('error');
    expect(s['links-rel-readable']).toBe('error');
    expect(s['links-internal-count']).toBe('warning');
    expect(s['links-external-count']).toBe('pass');
    expect(links(linkBlock([lnk()], { external_links: 0 }))['links-external-count']).toBe('not_applicable');
  });
});
