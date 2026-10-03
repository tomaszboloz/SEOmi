import { describe, expect, it } from 'vitest';
import { buildLocalAuditChecks } from '@/services/auditChecks';

import { audit } from "./fixtures/auditChecksContracts";

describe('buildLocalAuditChecks', () => {

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
