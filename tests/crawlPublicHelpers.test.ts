import { expect, it } from 'vitest';
import * as helpers from '@/components/Domain/crawlResults/crawlResultsHelpers';
import {createCrawlPageFixture} from './fixtures/crawl';

it('renders unavailable optional values consistently while retaining measured zero',()=>{
  expect(helpers.optional(undefined)).toBe('—');
  expect(helpers.optional(null)).toBe('—');
  expect(helpers.optional('')).toBe('—');
  expect(helpers.optional(0)).toBe('0');
  expect(helpers.optional('fixture')).toBe('fixture');
});

it('checks native issue evidence without mutating the snapshot',()=>{
  const page=createCrawlPageFixture({issues:[{severity:'Warning',message:'Duplicate TITLE found'}]});
  expect(helpers.issueMessageIncludes(page,'duplicate title')).toBe(true);
  expect(helpers.issueMessageIncludes(page,'description')).toBe(false);
  expect(page.issues[0].message).toBe('Duplicate TITLE found');
});

it('excludes non-HTML metadata and distinguishes missing and explicitly empty HTML titles',()=>{
  expect(helpers.metadataFacetsForPage(createCrawlPageFixture({content_type:'application/pdf'}))).toEqual([]);
  expect(helpers.metadataFacetsForPage(createCrawlPageFixture())).toEqual(['missing-title','missing-description']);
  expect(helpers.metadataFacetsForPage(createCrawlPageFixture({title:' ',meta_description:'',issues:[{severity:'Warning',message:'Meta description is empty'}]}))).toEqual(['empty-title','empty-description']);
});

it('uses measured metadata lengths at both boundaries and retained legacy server findings',()=>{
  const base=createCrawlPageFixture({title:'Fixture title',meta_description:'Fixture description'});
  for(const title_length of [30,60]) for(const meta_description_length of [70,160]) {
    expect(helpers.metadataFacetsForPage({...base,title_length,meta_description_length})).toEqual([]);
  }
  expect(helpers.metadataFacetsForPage({...base,title_length:29,meta_description_length:161})).toEqual(['title-length','description-length']);
  expect(helpers.metadataFacetsForPage({...base,issues:[{severity:'Warning',message:'Title length is invalid'},{severity:'Warning',message:'Meta description length is invalid'},{severity:'Warning',message:'Duplicate title'},{severity:'Warning',message:'Duplicate meta description'}]})).toEqual(['title-length','duplicate-title','description-length','duplicate-description']);
});

it('keeps tab group selection aligned with the exposed tab catalogue',()=>{
  for(const group of helpers.tabGroups) for(const tab of group.tabs) expect(helpers.tabGroupForTab(tab)).toBe(group.id);
  expect(helpers.tabGroupForTab('unknown' as helpers.CrawlTab)).toBe('core');
});

it('creates independent navigation defaults so changing one instance cannot contaminate another project',()=>{
  const first=helpers.emptyCrawlNavigationPreferences();first.activeTab='exports';
  expect(helpers.emptyCrawlNavigationPreferences()).toEqual({activeTab:'overview',activeTabGroup:'core',metadataFacet:'all',validationQuery:'',validationSeverity:'all'});
  const links=helpers.emptyCrawlLinkNavigationPreferences();links.query='changed';
  expect(helpers.emptyCrawlLinkNavigationPreferences()).toEqual({query:'',kind:'all',status:'all',sort:'source',descending:false});
});

it('formats rounded numbers with the active locale and retains historical filter namespaces',()=>{
  expect(helpers.formatNumber(1234.6)).toBe((1235).toLocaleString());
  expect(helpers.formatNumber(0)).toBe('0');
  expect(helpers.filterPresetsKey('a')).toBe('seomi_project_a_crawl_filter_presets_v1');
  expect(helpers.filterPresetsKey('b')).not.toBe(helpers.filterPresetsKey('a'));
});

it('returns only persisted discovery provenance and a clear empty list for legacy snapshots',()=>{
  const source={kind:'seed' as const,source_url:'https://example.test/'};
  expect(helpers.discoverySourcesForPage(createCrawlPageFixture())).toEqual([]);
  const page=createCrawlPageFixture({discovery_sources:[source]});
  expect(helpers.discoverySourcesForPage(page)).toEqual([source]);
});
