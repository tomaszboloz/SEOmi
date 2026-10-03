import {expect,it} from 'vitest';
import {parseCrawlConfig,parseSiteCrawlResult,parseCrawlRuns} from '@/services/crawlContracts';
import {createCrawlPageFixture,createCrawlResultFixture,createCrawlRunFixture} from './fixtures/crawl';

const nativeLink={target_url:'https://example.test/',anchor_text:'',is_internal:false,rel:null,source_excerpt:null,target_http_status:null,target_response_time_ms:null,target_redirect_url:null,target_request_error_kind:null,target_checked_at:null};
const nativeImage={src:'https://example.test/image',lazy_loaded:false,alt:null,srcset:null,format:null,width:null,height:null,dimensions_source:null,checked_in_run:null,http_status:null,content_length:null,request_error_kind:null,srcset_resource_checks:null,srcset_resource_checks_truncated:null};
const nativeFrame={src:null,resolved_url:null,title:null,name:null,loading:null,sandbox:null,checked_in_run:null,http_status:null,request_error_kind:null};
const nativeResource={source_urls:[],url:'https://example.test/image',resource_type:'image',http_status:null,content_type:null,content_length:null,intrinsic_width:null,intrinsic_height:null,dimensions_source:null,response_time_ms:null,request_error_kind:null};

it('accepts optional native null configuration while keeping false and zero explicit',()=>{
  const native={crawlMode:null,renderWaitForSelector:null,renderWaitDelayMs:null,renderLazyScrollCycles:null,maxPages:null,maxDepth:null,allowedHosts:null,scopePath:null,maxRedirects:null,maxResponseBytes:null,maxRunSeconds:null,requestTimeoutSecs:null,verifySsl:null,seedUrls:null,listMode:null,userAgent:null,requestProfileId:null,trimTrailingSlash:null,lowercasePath:null,stripTrackingParameters:null,allowedQueryParameters:null,deniedQueryParameters:null,customSearches:null,focusPhrase:null,crawlImages:null,crawlStylesheets:null,crawlScripts:null,crawlOtherResources:null,maxResourceRequests:null,maxConcurrentRequests:null,resumeCompletedUrls:null,resumeFrontierUrls:null};
  const parsed=parseCrawlConfig(native);
  expect(parsed).not.toBeNull();
  expect(parsed?.maxDepth).toBeUndefined();expect(parsed?.verifySsl).toBeUndefined();
  expect(parseCrawlConfig({verifySsl:false,maxDepth:0,renderWaitDelayMs:0})).toMatchObject({verifySsl:false,maxDepth:0,renderWaitDelayMs:0});
  expect(native.verifySsl).toBeNull();
});

it('reads native nullable page evidence without converting unknown status or dimensions into zero',()=>{
  const page={...createCrawlPageFixture(),title:null,meta_description:null,
    discovery_sources:null,canonical_targets:null,canonical_declaration_count:null,canonical_relation:null,canonical_robots_conflict:null,client_redirects:null,
    content_terms:null,semantic_terms:null,semantic_excerpts:null,semantic_links:null,semantic_content_source:null,semantic_content_provenance:null,semantic_content_partial:null,
    schema_references:null,schema_validation_findings:null,schema_validation_truncated:null,html_validation_findings:null,html_validation_truncated:null,
    amp_target_checked_in_run:null,heading_counts:null,duplicate_headings:null,pagination_links:null,pagination_declaration_count:null,pagination_invalid_declaration_count:null,
    frames:[nativeFrame],frames_truncated:null,favicons:null,favicon_metadata:null,favicon_resource_checks:null,social_meta_tags:null,custom_search_results:null,
    links:[nativeLink],images:[nativeImage],issues:[{severity:'Info',message:'Unavailable',code:null}],
    hreflangs:[{language:'en',target_url:'https://example.test/',target_checked_in_run:null}],
    robots_decision:{indexability:'unknown',link_following:'unknown',directives:null,sources:null,response_headers_available:false},
  };
  const parsed=parseSiteCrawlResult({...createCrawlResultFixture(),pages:[page],resources:[nativeResource]});
  expect(parsed).not.toBeNull();
  expect(parsed?.pages[0]).toMatchObject({title:null,meta_description:null});
  expect(parsed?.pages[0].links[0].target_http_status).toBeUndefined();
  expect(parsed?.pages[0].images[0].width).toBeUndefined();
  expect(parsed?.pages[0].images[0].lazy_loaded).toBe(false);
  expect(parsed?.pages[0].frames?.[0].http_status).toBeUndefined();
  expect(parsed?.resources?.[0].http_status).toBeUndefined();
  expect(page.title).toBeNull();expect(page.links[0].target_http_status).toBeNull();
});

it('keeps nullable native run limits and scope metadata compatible with legacy history',()=>{
  const result={...createCrawlResultFixture(),crawl_mode:null,timed_out:null,robots_user_agent:null,robots_applicable_rules:null,robots_agent_matrix:null,robots_sitemap_directives:null,rejected_urls:null,resources:null,resource_limit_reached:null,storage_pages_truncated:null,storage_pages_total:null,discovery_provenance_truncated:null,limit_reasons:null};
  const parsed=parseCrawlRuns([{...createCrawlRunFixture(),result,environment:null,storage_compacted:null}]);
  expect(parsed).toHaveLength(1);
  expect(parsed[0].result.resource_limit_reached).toBeUndefined();
  expect(parsed[0].result.storage_pages_total).toBeUndefined();
  expect(parsed[0].environment).toBeUndefined();
  expect(parsed[0].storage_compacted).toBeUndefined();
  expect(parsed[0].result.cancelled).toBe(false);
});

it('validates populated native HTML, structured and favicon evidence including optional diagnostics',()=>{
  const page=createCrawlPageFixture();
  const raw={...page,
    schema_validation_findings:[{format:'jsonld',declaration_index:0,finding:{code:'invalid',severity:'warning',message:'Fixture',path:'$.name',recommendation:'Review'}}],
    html_validation_findings:[{code:'missing',severity:'Warning',message:'Fixture',element:'img',attribute:'alt',value:'',line:0,column:0,source_excerpt:'<img>'}],
    favicon_metadata:[{href:'/favicon.ico',rel:'icon',declared_type:'image/x-icon',declared_sizes:'any',inferred_format:'ico'}],
    frames:[{...nativeFrame,src:'/frame',resolved_url:'https://example.test/frame',title:'Frame',name:'frame',loading:'lazy',sandbox:'',checked_in_run:false,http_status:0,request_error_kind:'transport'}],
  };
  const parsed=parseSiteCrawlResult({...createCrawlResultFixture(),pages:[raw]});
  expect(parsed?.pages[0].html_validation_findings?.[0]).toMatchObject({line:0,column:0,value:''});
  expect(parsed?.pages[0].frames?.[0]).toMatchObject({http_status:0,checked_in_run:false});
  expect(parsed?.pages[0].schema_validation_findings?.[0].finding.path).toBe('$.name');
  expect(parsed?.pages[0].favicon_metadata?.[0].declared_sizes).toBe('any');
  const nullable={...raw,html_validation_findings:[{code:'missing',severity:'Warning',message:'Fixture',element:null,attribute:null,value:null,line:null,column:null,source_excerpt:null}],schema_validation_findings:[{format:'jsonld',declaration_index:0,finding:{code:'invalid',severity:'warning',message:'Fixture',path:null,recommendation:null}}],favicon_metadata:[{href:'/icon',rel:'icon',declared_type:null,declared_sizes:null,inferred_format:null}]};
  const unknown=parseSiteCrawlResult({...createCrawlResultFixture(),pages:[nullable]});
  expect(unknown?.pages[0].html_validation_findings?.[0].line).toBeUndefined();
  expect(unknown?.pages[0].schema_validation_findings?.[0].finding.path).toBeUndefined();
  expect(unknown?.pages[0].favicon_metadata?.[0].declared_type).toBeUndefined();
});

it('rejects malformed nested evidence instead of silently replacing it with a valid empty crawl',()=>{
  for(const patch of [{links:[{...nativeLink,target_http_status:'200'}]},{images:[{...nativeImage,width:'100'}]},{frames:[{...nativeFrame,checked_in_run:'false'}]},{hreflangs:[{language:'en',target_url:false}]},{schema_validation_findings:[{format:'jsonld',declaration_index:0,finding:{code:'x',severity:'Critical',message:'bad'}}]}]) {
    expect(parseSiteCrawlResult({...createCrawlResultFixture(),pages:[{...createCrawlPageFixture(),...patch}]})).toBeNull();
  }
});
