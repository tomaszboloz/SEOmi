import { describe, expect, it } from 'vitest';
import { buildLocalAuditChecks } from '@/services/auditChecks';
import { PageAuditData } from '@/types';
import i18n from '@/i18n';

const audit = (overrides: Partial<PageAuditData> = {}): PageAuditData => ({
  url: 'https://example.com', final_url: 'https://example.com', timestamp: '2026-09-21T00:00:00.000Z', http_status: 200, response_time_ms: 120, redirect_chain: [],
  meta_tags: { title: 'Prawidłowy tytuł strony testowej', title_length: 32, description: 'Opis strony o prawidłowej długości, wystarczający do kontroli lokalnego audytu SEO.', description_length: 84, canonical: 'https://example.com', other_tags: [] },
  open_graph: { all_tags: [] }, twitter_card: { all_tags: [] }, headings: { h1_count: 1, h1_texts: ['Temat'], hierarchy: [], has_valid_hierarchy: true, issues: [] }, images: [], links: { total_links: 0, internal_links: 0, external_links: 0, nofollow_links: 0, links: [] }, security_headers: { score: 90 }, structured_data: [], technical: { hreflang_tags: [] }, health_score: 100, issues: [], content_stats: { word_count: 100, reading_time_minutes: 1, text_ratio_percent: 10, top_keywords: [] },
  ...overrides,
});

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

  it('checks security headers and all cookie flags without exposing values', () => {
    const checks = buildLocalAuditChecks(audit({
      security_headers:{score:50,strict_transport_security:'max-age=31536000',content_security_policy:"default-src 'self'",x_frame_options:'DENY',x_content_type_options:'nosniff',referrer_policy:'no-referrer',permissions_policy:'camera=()',cross_origin_opener_policy:'same-origin',cross_origin_resource_policy:'same-origin',server:'server-name',x_powered_by:'framework'},
      transport_security:{scheme:'https',https:true,mixed_content_urls:[],cookies:[{name:'session',secure:true,http_only:false,same_site:null}],tls_coverage:'Negotiated TLS'},
    }));
    for(const id of ['security-hsts','security-csp','security-xfo','security-xcto','security-referrer','security-permissions','security-coop','security-corp']) {
      expect(checks.find(item => item.id === id)?.status, id).toBe('pass');
    }
    for(const id of ['security','security-server-disclosure','security-powered-by','security-cookies']) {
      expect(checks.find(item => item.id === id)?.status, id).toBe('warning');
    }
    expect(checks.find(item => item.id === 'transport-cookies')?.status).toBe('pass');
  });

  it('aggregates structured findings independently across declarations', () => {
    const checks = buildLocalAuditChecks(audit({structured_data:[
      {format:'JSON-LD',data_type:'Product',content:{'@type':'Product'},validation_issues:[{code:'invalid',severity:'error',message:'Invalid value',path:'$.name'}]},
      {format:'Microdata',data_type:'Product',content:{itemtype:'https://schema.org/Product'},validation_issues:[{code:'missing',severity:'warning',message:'Missing offer'}]},
    ]}));
    expect(checks.find(item => item.id === 'structured-errors')?.status).toBe('error');
    expect(checks.find(item => item.id === 'structured-warnings')?.status).toBe('warning');
    expect(checks.find(item => item.id === 'structured-unique-types')?.status).toBe('warning');
    expect(checks.find(item => item.id === 'structured-format-coverage')?.status).toBe('pass');
    expect(checks.find(item => item.id === 'structured-finding-paths')?.status).toBe('pass');
  });

  it('checks duplicate hreflang, relative destinations and technology evidence', () => {
    const checks = buildLocalAuditChecks(audit({technical:{
      hreflang_tags:[{hreflang:'pl',href:'https://example.com/pl'},{hreflang:'PL',href:'/pl'}],
      favicons:[{href:'/icon.png',rel:'icon'}],robots_txt_url:'https://example.com/robots.txt',sitemap_url:'https://example.com/sitemap.xml',content_type:'text/html',
      technology_signals:[{name:'Generator',category:'cms',confidence:'confirmed',evidence:'meta generator'}, {name:'',category:'cms',confidence:'heuristic',evidence:''}],
    }}));
    expect(checks.find(item => item.id === 'technical-hreflang-unique')?.status).toBe('warning');
    expect(checks.find(item => item.id === 'technical-hreflang-http')?.status).toBe('warning');
    expect(checks.find(item => item.id === 'technical-technology-signals')?.status).toBe('warning');
    expect(checks.find(item => item.id === 'technical-technology-confidence')?.status).toBe('pass');
    expect(checks.find(item => item.id === 'technical-favicon')?.status).toBe('pass');
  });

  it('retains readability boundaries and marks truncated text', () => {
    const checks = buildLocalAuditChecks(audit({content_stats:{word_count:120,reading_time_minutes:1,text_ratio_percent:20,top_keywords:[{keyword:'SEO',count:40,density_percent:26}],sentence_count:4,average_words_per_sentence:31,average_characters_per_word:13,complexity_score:71,readability_ease_score:49,readability_grade:13,body_text:'Visible text',body_text_truncated:true}}));
    for(const id of ['content-average-sentence','content-average-word','content-complexity','content-readability','content-readability-grade','content-keyword-density','content-truncation']) {
      expect(checks.find(item => item.id === id)?.status, id).toBe('warning');
    }
    expect(checks.find(item => item.id === 'content-sentence-count')?.evidence).toBe('4');
  });

});
