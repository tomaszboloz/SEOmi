import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { CrawlCustomSearchEditor } from '@/components/Domain/siteAudit/CrawlCustomSearchEditor';

import { CrawlRenderOptions } from '@/components/Domain/siteAudit/CrawlRenderOptions';
import { CrawlConfigurationForm } from '@/components/Domain/siteAudit/CrawlConfigurationForm';
import { useToolsStore } from '@/stores/toolsStore';
import { useProjectStore } from '@/stores/projectStore';

import { tools, projects, makeSession, text } from "./fixtures/crawlControlPanelsContracts";

beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({ activeProjectId:'panel-test' });
  useToolsStore.setState({crawlRuns:[],crawlResult:null,isCrawling:false,isCrawlPaused:false});
});

afterEach(() => { cleanup(); useToolsStore.setState(tools); useProjectStore.setState(projects); vi.restoreAllMocks(); });

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
