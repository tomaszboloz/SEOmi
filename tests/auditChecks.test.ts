import { describe, expect, it } from 'vitest';
import { buildLocalAuditChecks } from '@/services/auditChecks';

import i18n from '@/i18n';
import { audit } from "./fixtures/auditChecksContracts";

describe('buildLocalAuditChecks', () => {

it('exposes a stable 100+ point coverage contract with categories', () => {
    const checks = buildLocalAuditChecks(audit());
    expect(checks.length).toBeGreaterThanOrEqual(100);
    expect(new Set(checks.map((item) => item.id)).size).toBe(checks.length);
    expect(new Set(checks.map((item) => item.category)).size).toBeGreaterThanOrEqual(10);
    expect(checks.every((item) => item.evidence.trim().length > 0)).toBe(true);
  });

it('reports only evidence-backed passed checks', () => {
    const checks = buildLocalAuditChecks(audit());
    expect(checks.find((item) => item.id === 'http')).toMatchObject({ status: 'pass', evidence: 'HTTP 200' });
    expect(checks.find((item) => item.id === 'images-alt')).toMatchObject({ status: 'not_applicable' });
  });

it('reports missing and non-responsive viewport declarations explicitly', () => {
    expect(buildLocalAuditChecks(audit()).find((item) => item.id === 'viewport')).toMatchObject({
      status: 'error',
      evidence: i18n.t('auditChecks.evidence.missingViewport'),
    });
    expect(buildLocalAuditChecks(audit({
      meta_tags: {
        title: 'Prawidłowy tytuł strony testowej',
        title_length: 32,
        description: 'Opis strony o prawidłowej długości, wystarczający do kontroli lokalnego audytu SEO.',
        description_length: 84,
        canonical: 'https://example.com',
        viewport: 'initial-scale=1',
        other_tags: [],
      },
    })).find((item) => item.id === 'viewport')).toMatchObject({ status: 'warning' });
    expect(buildLocalAuditChecks(audit({
      meta_tags: {
        title: 'Prawidłowy tytuł strony testowej',
        title_length: 32,
        description: 'Opis strony o prawidłowej długości, wystarczający do kontroli lokalnego audytu SEO.',
        description_length: 84,
        canonical: 'https://example.com',
        viewport: 'width=device-width, initial-scale=1',
        other_tags: [],
      },
    })).find((item) => item.id === 'viewport')).toMatchObject({ status: 'pass' });
  });

it('reports missing title and HTTP failure as errors', () => {
    const checks = buildLocalAuditChecks(audit({ http_status: 404, meta_tags: { title_length: 0, description_length: 0, other_tags: [] } }));
    expect(checks.find((item) => item.id === 'http')?.status).toBe('error');
    expect(checks.find((item) => item.id === 'title')?.status).toBe('error');
  });

it('uses the unified indexability verdict when an audit includes it', () => {
    const checks = buildLocalAuditChecks(audit({
      indexability: {
        status: 'blocked',
        reasons: ['Nagłówek X-Robots-Tag zawiera dyrektywę noindex lub none.'],
        x_robots_tag: 'noindex',
      },
    }));

    expect(checks.find((item) => item.id === 'indexability')).toMatchObject({
      status: 'error',
      evidence: expect.stringContaining('X-Robots-Tag'),
    });
  });

it('reports static accessibility evidence without pretending to test contrast', () => {
    const checks = buildLocalAuditChecks(audit({
      accessibility: {
        document_language: 'pl',
        landmarks: [{ name: 'main', count: 1 }],
        aria_attribute_count: 2,
        form_control_count: 1,
        unlabeled_form_control_count: 0,
        manual_review_items: ['Kontrast kolorów wymaga renderowanego widoku strony.'],
      },
    }));

    expect(checks.find((item) => item.id === 'accessibility-basics')).toMatchObject({
      status: 'pass',
      evidence: expect.stringContaining('lang=pl'),
    });
  });

it.each([199, 200, 299, 300, 399, 400, 503])('classifies HTTP %i and preserves the measured status', (status) => {
    const result = buildLocalAuditChecks(audit({ http_status: status })).find(item => item.id === 'http');
    const expected = new Map([[199,'error'],[200,'pass'],[299,'pass'],[300,'warning'],[399,'warning'],[400,'error'],[503,'error']]);
    expect(result).toMatchObject({status: expected.get(status), evidence: `HTTP ${status}`});
  });

it.each([[299,'pass','pass'],[300,'warning','pass'],[799,'warning','pass'],[800,'warning','warning'],[1999,'warning','warning'],[2000,'warning','error']] as const)(
    'checks response time boundary %i ms independently', (time, fast, standard) => {
      const checks = buildLocalAuditChecks(audit({response_time_ms:time}));
      expect(checks.find(item => item.id === 'response-time-fast')?.status).toBe(fast);
      expect(checks.find(item => item.id === 'response-time')?.status).toBe(standard);
      expect(checks.find(item => item.id === 'response-time-known')?.status).toBe('pass');
    });

it('checks actual redirect hops, locations and invalid statuses', () => {
    const checks = buildLocalAuditChecks(audit({redirect_chain:[
      {url:'https://example.com/a',status_code:301,location:'/b'},
      {url:'https://example.com/b',status_code:200,location:''},
      {url:'https://example.com/c',status_code:302,location:'/d'},
    ]}));
    expect(checks.find(item => item.id === 'redirect-chain')?.status).toBe('error');
    expect(checks.find(item => item.id === 'redirect-statuses')?.status).toBe('error');
    expect(checks.find(item => item.id === 'redirect-locations')).toMatchObject({status:'warning'});
    expect(checks.find(item => item.id === 'redirect-statuses')?.evidence).toBe('301 → 200 → 302');
  });

it('detects social duplicates, misaligned titles and nonabsolute images', () => {
    const checks = buildLocalAuditChecks(audit({
      open_graph:{og_title:'Other title',og_description:'Description',og_image:'/image.jpg',og_url:'https://other.example/',og_image_width:'600',all_tags:[{property:'og:title',content:'A'},{name:' OG:TITLE ',content:'B'}, {content:'C'}]},
      twitter_card:{twitter_card:'unsupported',twitter_title:'Other title',twitter_description:'Description',twitter_image:'/card.jpg',twitter_site:'@site',twitter_creator:'@author',all_tags:[{name:'twitter:title',content:'A'},{property:'TWITTER:TITLE',content:'B'}]},
    }));
    for(const id of ['og-tag-duplicates','og-title-alignment','og-image-absolute','og-image-dimensions','og-url-match','twitter-tags-duplicates','twitter-card-supported','twitter-title-alignment','twitter-image-absolute']) {
      expect(checks.find(item => item.id === id)?.status, id).toBe('warning');
    }
    expect(checks.find(item => item.id === 'twitter-site')?.evidence).toBe('@site');
  });

it('assesses observed image attributes and HTTPS mixed content', () => {
    const checks = buildLocalAuditChecks(audit({images:[
      {src:'http://cdn.example/a.jpg',has_alt:false,width:'100',format:'jpg'},
      {src:'/b.webp',has_alt:true,alt:' ',loading:'LAZY',srcset:'/b.webp 1x',width:'100',height:'100',format:'webp'},
      {src:'http://cdn.example/a.jpg',has_alt:true,alt:'Photo',format:'jpg'},
    ]}));
    for(const id of ['images-alt','images-alt-nonempty','images-dimensions','images-dimensions-pair','images-modern-format','images-duplicate-src']) {
      expect(checks.find(item => item.id === id)?.status, id).toBe('warning');
    }
    expect(checks.find(item => item.id === 'images-insecure')?.status).toBe('error');
    expect(checks.find(item => item.id === 'images-loading')?.status).toBe('pass');
    expect(checks.find(item => item.id === 'images-srcset')?.status).toBe('pass');
  });
});
