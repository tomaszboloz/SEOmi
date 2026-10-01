import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useSiteAuditSession } from '@/components/Domain/siteAudit/useSiteAuditSession';
import { CrawlStartControls } from '@/components/Domain/siteAudit/CrawlStartControls';
import { CrawlProgressStatus } from '@/components/Domain/siteAudit/CrawlProgressStatus';
import { CrawlEnvironmentComparison } from '@/components/Domain/siteAudit/CrawlEnvironmentComparison';
import { CrawlRequestProfileForm } from '@/components/Domain/siteAudit/CrawlRequestProfileForm';
import { CrawlCustomSearchEditor } from '@/components/Domain/siteAudit/CrawlCustomSearchEditor';
import { CrawlUrlRules } from '@/components/Domain/siteAudit/CrawlUrlRules';
import { CrawlSavedRequestProfiles } from '@/components/Domain/siteAudit/CrawlSavedRequestProfiles';
import { CrawlRenderOptions } from '@/components/Domain/siteAudit/CrawlRenderOptions';
import { CrawlConfigurationForm } from '@/components/Domain/siteAudit/CrawlConfigurationForm';
import { useToolsStore } from '@/stores/toolsStore';
import { useProjectStore } from '@/stores/projectStore';
import i18n from '@/i18n';

type Session = ReturnType<typeof useSiteAuditSession>;
const tools = useToolsStore.getState();
const projects = useProjectStore.getState();
beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({ activeProjectId:'panel-test' });
  useToolsStore.setState({crawlRuns:[],crawlResult:null,isCrawling:false,isCrawlPaused:false});
});
afterEach(() => { cleanup(); useToolsStore.setState(tools); useProjectStore.setState(projects); vi.restoreAllMocks(); });
const makeSession = (patch:Partial<Session> = {}): Session => {
  const {result} = renderHook(()=>useSiteAuditSession());
  return {...result.current,...patch};
};
const text = (key:string) => i18n.t(key);

it('starts a crawl with editable URL, page limit and render mode', () => {
  const session = makeSession({desktopAvailable:true,setInputUrl:vi.fn(),setSelectedLimit:vi.fn(),setCrawlConfig:vi.fn(),handleStartCrawl:vi.fn(event=>event.preventDefault())});
  const {container} = render(<CrawlStartControls session={session}/>);
  fireEvent.change(screen.getByLabelText(text('siteAudit.startUrlAria')),{target:{value:'https://example.test/docs'}});
  fireEvent.change(screen.getByLabelText(text('siteAudit.pageLimitAria')),{target:{value:'250'}});
  fireEvent.change(screen.getByLabelText(text('siteAudit.renderModeAria')),{target:{value:'browser-rendered'}});
  fireEvent.submit(container.querySelector('form')!);
  expect(session.setInputUrl).toHaveBeenCalledWith('https://example.test/docs');
  expect(session.setSelectedLimit).toHaveBeenCalledWith(250);
  expect(session.setCrawlConfig).toHaveBeenCalledWith({crawlMode:'browser-rendered'});
  expect(session.handleStartCrawl).toHaveBeenCalledOnce();
});

it.each([{desktopAvailable:false,isCrawling:false},{desktopAvailable:true,isCrawling:true}])('disables starting while unavailable or already crawling: %j', patch => {
  render(<CrawlStartControls session={makeSession(patch)}/>);
  expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole('button').getAttribute('aria-disabled')).toBe('true');
});

it.each([false,true])('routes pause/resume and cancel independently when paused=%s', paused => {
  const session = makeSession({isCrawlPaused:paused,pauseSiteCrawl:vi.fn(),resumeSiteCrawl:vi.fn(),cancelSiteCrawl:vi.fn()});
  render(<CrawlProgressStatus session={session}/>);
  fireEvent.click(screen.getByRole('button',{name:text(paused?'siteAudit.resumeCrawl':'siteAudit.pauseCrawl')}));
  fireEvent.click(screen.getByRole('button',{name:text('siteAudit.cancelCrawl')}));
  expect(paused?session.resumeSiteCrawl:session.pauseSiteCrawl).toHaveBeenCalledOnce();
  expect(paused?session.pauseSiteCrawl:session.resumeSiteCrawl).not.toHaveBeenCalled();
  expect(session.cancelSiteCrawl).toHaveBeenCalledOnce();
  expect(screen.queryByText(text('siteAudit.pausedNotice')) !== null).toBe(paused);
  expect(screen.getByText('0/0')).toBeDefined();
});

it.each([
  {desktopAvailable:false}, {isCrawling:true}, {isEnvironmentComparisonRunning:true},
  {environmentUrls:{staging:' ',production:'https://prod.test'}},
  {environmentUrls:{staging:'https://stage.test',production:''}},
])('blocks environment comparison until both URLs and runtime are ready: %j', patch => {
  render(<CrawlEnvironmentComparison session={makeSession({desktopAvailable:true,environmentUrls:{staging:'https://stage.test',production:'https://prod.test'},...patch})}/>);
  expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
});

it('edits environment URLs, runs comparison and exposes a real error', () => {
  const session = makeSession({desktopAvailable:true,environmentUrls:{staging:'https://stage.test',production:'https://prod.test'},updateEnvironmentUrl:vi.fn(),runEnvironmentComparison:vi.fn(),environmentComparisonError:'Provider rejected staging URL'});
  render(<CrawlEnvironmentComparison session={session}/>);
  fireEvent.change(screen.getByLabelText(text('siteAudit.environmentStagingUrl')),{target:{value:'https://new-stage.test'}});
  fireEvent.change(screen.getByLabelText(text('siteAudit.environmentProductionUrl')),{target:{value:'https://new-prod.test'}});
  fireEvent.click(screen.getByRole('button'));
  expect(session.updateEnvironmentUrl).toHaveBeenCalledWith('staging','https://new-stage.test');
  expect(session.updateEnvironmentUrl).toHaveBeenCalledWith('production','https://new-prod.test');
  expect(session.runEnvironmentComparison).toHaveBeenCalledOnce();
  expect(screen.getByRole('alert').textContent).toBe('Provider rejected staging URL');
});

it('edits request profile values and keeps cookies and proxy credentials masked', () => {
  const session = makeSession({setRequestProfileName:vi.fn(),setRequestProfileCookie:vi.fn(),setRequestProfileProxyUrl:vi.fn(),setRequestProfileHeaders:vi.fn()});
  render(<CrawlRequestProfileForm session={session}/>);
  for(const [key,value,callback] of [
    ['newProfileName','Authenticated',session.setRequestProfileName],
    ['sessionCookies','session=private',session.setRequestProfileCookie],
    ['httpProxy','http://user:password@proxy.test:8080',session.setRequestProfileProxyUrl],
    ['customHeaders','X-Source: unit-test',session.setRequestProfileHeaders],
  ] as const) {
    const input = screen.getByLabelText(label => label.startsWith(text(`siteAudit.${key}`)));
    fireEvent.change(input,{target:{value}});
    expect(callback).toHaveBeenCalledWith(value);
    if(key==='sessionCookies'||key==='httpProxy')expect(input.getAttribute('type')).toBe('password');
  }
});

it('selects, removes and saves profiles without displaying their secret contents', () => {
  const base = makeSession();
  const session:Session = {...base,crawlConfig:{...base.crawlConfig,requestProfileId:'private-profile'},crawlRequestProfiles:[{id:'private-profile',name:'Private profile',userAgent:'SEOmi Test Agent',createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-01T00:00:00Z',hasCookie:true,hasHeaders:true,hasProxy:true}],selectRequestProfile:vi.fn(),removeRequestProfile:vi.fn(),saveRequestProfile:vi.fn(),setCrawlConfig:vi.fn(),requestProfileStatus:'Stored securely'};
  render(<CrawlSavedRequestProfiles session={session}/>);
  fireEvent.change(screen.getByLabelText(text('siteAudit.activeProfile')),{target:{value:''}});
  fireEvent.change(screen.getByLabelText(text('urlBar.userAgent')),{target:{value:'SEOmi Test Agent'}});
  fireEvent.click(screen.getByRole('button',{name:text('siteAudit.removeProfile')}));
  fireEvent.click(screen.getByRole('button',{name:text('siteAudit.saveProfile')}));
  expect(session.selectRequestProfile).toHaveBeenCalledWith('');
  expect(session.setCrawlConfig).toHaveBeenCalledWith({userAgent:'SEOmi Test Agent'});
  expect(session.removeRequestProfile).toHaveBeenCalledOnce();
  expect(session.saveRequestProfile).toHaveBeenCalledOnce();
  expect(screen.getByText('Stored securely')).toBeDefined();
});

it('forces text results on regex selection and removes only the chosen custom search', () => {
  const session = makeSession({customSearches:[{id:'first',name:'First',selectorType:'css',query:'a',resultType:'attribute',attribute:'href'},{id:'second',name:'Second',selectorType:'xpath',query:'//a',resultType:'text'}],updateCustomSearch:vi.fn(),setCrawlConfig:vi.fn(),addCustomSearch:vi.fn()});
  render(<CrawlCustomSearchEditor session={session}/>);
  fireEvent.change(screen.getByLabelText(`${text('crawl.customSearch.selectorType')} First`),{target:{value:'regex'}});
  expect(session.updateCustomSearch).toHaveBeenCalledWith('first',{selectorType:'regex',resultType:'text',attribute:undefined});
  fireEvent.change(screen.getByLabelText(`${text('crawl.customSearch.attribute')} First`),{target:{value:'title'}});
  expect(session.updateCustomSearch).toHaveBeenCalledWith('first',{attribute:'title'});
  fireEvent.click(screen.getAllByRole('button',{name:text('crawl.customSearch.remove')})[0]);
  expect(session.setCrawlConfig).toHaveBeenCalledWith({customSearches:[session.customSearches[1]]});
});

it('disables result type selection for regex and supports the empty custom search state', () => {
  const session = makeSession({customSearches:[{id:'regex',name:'Regex',selectorType:'regex',query:'SEO',resultType:'text'}],addCustomSearch:vi.fn()});
  const {rerender} = render(<CrawlCustomSearchEditor session={session}/>);
  expect((screen.getByLabelText(`${text('crawl.customSearch.resultType')} Regex`) as HTMLSelectElement).disabled).toBe(true);
  rerender(<CrawlCustomSearchEditor session={{...session,customSearches:[]}}/>);
  expect(screen.getByText(text('crawl.customSearch.empty'))).toBeDefined();
  fireEvent.click(screen.getByRole('button'));
  expect(session.addCustomSearch).toHaveBeenCalledOnce();
});

it('shows invalid filter diagnostics and runs validation on request', () => {
  const session = makeSession({validateFilters:vi.fn(),filterValidation:{valid:false,errors:[{filter:'includePatterns',pattern:'[',message:'Unclosed character class'}],previews:[]}});
  render(<CrawlUrlRules session={session}/>);
  expect(screen.getByText(/Unclosed character class/)).toBeDefined();
  fireEvent.click(screen.getByRole('button'));
  expect(session.validateFilters).toHaveBeenCalledOnce();
});

it('retains included and excluded URL preview evidence after successful validation', () => {
  render(<CrawlUrlRules session={makeSession({filterValidation:{valid:true,errors:[],previews:[{url:'https://example.test/a',included:true,reason:'Matched include'},{url:'https://example.test/b',included:false,reason:'Matched exclude'}]}})}/>);
  expect(screen.getByText(text('siteAudit.included'))).toBeDefined();
  expect(screen.getByText(text('siteAudit.excluded'))).toBeDefined();
  expect(screen.getByText('Matched include')).toBeDefined();
  expect(screen.getByText('Matched exclude')).toBeDefined();
});

it('preserves explicit zero depth and converts resource limits to native units', () => {
  const base = makeSession();
  const session = {...base,crawlConfig:{...base.crawlConfig,maxDepth:0,crawlImages:true},setCrawlConfig:vi.fn()};
  render(<CrawlConfigurationForm session={session}/>);
  const depth = screen.getByLabelText(new RegExp(text('siteAudit.maxDepth')));
  expect((depth as HTMLInputElement).value).toBe('0');
  fireEvent.change(depth,{target:{value:''}});
  expect(session.setCrawlConfig).toHaveBeenCalledWith({maxDepth:undefined});
  fireEvent.change(screen.getByLabelText(text('siteAudit.maxResponse')),{target:{value:'10'}});
  expect(session.setCrawlConfig).toHaveBeenCalledWith({maxResponseBytes:10_000_000});
  fireEvent.change(screen.getByLabelText(new RegExp(text('siteAudit.resourceConcurrency'))),{target:{value:'99'}});
  expect(session.setCrawlConfig).toHaveBeenCalledWith({maxConcurrentRequests:16});
});


it('updates crawl scope and URL normalization controls independently', () => {
  const base = makeSession();
  const session = {...base,crawlConfig:{...base.crawlConfig,keepQueryStrings:true,respectRobots:true},setCrawlConfig:vi.fn(),setFilterPatterns:vi.fn(),setAllowedHosts:vi.fn(),setQueryParameterNames:vi.fn()};
  render(<CrawlConfigurationForm session={session}/>);
  for(const [label,key] of [
    ['includeSubdomains','allowSubdomains'],['keepQueryStrings','keepQueryStrings'],
    ['respectRobots','respectRobots'],['respectCrawlDelay','respectCrawlDelay'],
    ['discoverSitemaps','discoverSitemaps'],['followNofollow','followNofollow'],
    ['listMode','listMode'],['crawlImages','crawlImages'],['crawlStylesheets','crawlStylesheets'],
    ['crawlScripts','crawlScripts'],['crawlOtherResources','crawlOtherResources'],
  ] as const) {
    const input = screen.getByLabelText(value=>value.startsWith(text(`siteAudit.${label}`))) as HTMLInputElement;
    const expected = !input.checked;
    fireEvent.click(input);
    expect(session.setCrawlConfig).toHaveBeenCalledWith({[key]:expected});
  }
  fireEvent.change(screen.getByLabelText(value=>value.startsWith(text('siteAudit.includeUrl'))),{target:{value:'/docs/\n/blog/'}});
  fireEvent.change(screen.getByLabelText(value=>value.startsWith(text('siteAudit.excludeUrl'))),{target:{value:'/private/'}});
  fireEvent.change(screen.getByLabelText(value=>value.startsWith(text('siteAudit.allowedHosts'))),{target:{value:'docs.example.test'}});
  fireEvent.change(screen.getByLabelText(value=>value.startsWith(text('siteAudit.allowedQueryNames'))),{target:{value:'page,lang'}});
  fireEvent.change(screen.getByLabelText(value=>value.startsWith(text('siteAudit.deniedQueryNames'))),{target:{value:'session'}});
  expect(session.setFilterPatterns).toHaveBeenCalledWith('includePatterns','/docs/\n/blog/');
  expect(session.setFilterPatterns).toHaveBeenCalledWith('excludePatterns','/private/');
  expect(session.setAllowedHosts).toHaveBeenCalledWith('docs.example.test');
  expect(session.setQueryParameterNames).toHaveBeenCalledWith('allowedQueryParameters','page,lang');
  expect(session.setQueryParameterNames).toHaveBeenCalledWith('deniedQueryParameters','session');
});

it('bounds rendered wait and lazy-scroll options and warns about transport overrides', () => {
  const base = makeSession();
  const session = {...base,crawlConfig:{...base.crawlConfig,requestProfileId:'profile'},renderedProfileHasTransportOverrides:true,setCrawlConfig:vi.fn()};
  const {rerender} = render(<CrawlRenderOptions session={session}/>);
  expect(screen.getByRole('alert').textContent).toBe(text('siteAudit.renderProfileWarning'));
  fireEvent.change(screen.getByLabelText(text('siteAudit.renderWaitSelectorAria')),{target:{value:'#app-ready'}});
  expect(session.setCrawlConfig).toHaveBeenCalledWith({renderWaitForSelector:'#app-ready'});
  for(const [label,key,upper] of [['renderDelayAria','renderWaitDelayMs',10000],['lazyScrollAria','renderLazyScrollCycles',40]] as const) {
    const input = screen.getByLabelText(text(`siteAudit.${label}`));
    fireEvent.change(input,{target:{value:String(upper+1)}});
    expect(session.setCrawlConfig).toHaveBeenCalledWith({[key]:upper});
    fireEvent.change(input,{target:{value:'-1'}});
    expect(session.setCrawlConfig).toHaveBeenCalledWith({[key]:0});
  }
  rerender(<CrawlRenderOptions session={{...session,renderedProfileHasTransportOverrides:false}}/>);
  expect(screen.queryByRole('alert')).toBeNull();
});

it('edits custom-search name, selector and extraction type for the correct row', () => {
  const session = makeSession({customSearches:[{id:'links',name:'Links',selectorType:'css',query:'a',resultType:'text'}],updateCustomSearch:vi.fn()});
  render(<CrawlCustomSearchEditor session={session}/>);
  fireEvent.change(screen.getByLabelText(`${text('crawl.customSearch.name')} Links`),{target:{value:'Link sources'}});
  fireEvent.change(screen.getByLabelText(`${text('crawl.customSearch.selector')} Links`),{target:{value:'a[href]'}});
  fireEvent.change(screen.getByLabelText(`${text('crawl.customSearch.resultType')} Links`),{target:{value:'html'}});
  expect(session.updateCustomSearch).toHaveBeenCalledWith('links',{name:'Link sources'});
  expect(session.updateCustomSearch).toHaveBeenCalledWith('links',{query:'a[href]'});
  expect(session.updateCustomSearch).toHaveBeenCalledWith('links',{resultType:'html'});
});
