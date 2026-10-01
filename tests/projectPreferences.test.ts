import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useProjectStore } from '@/stores/projectStore';
import * as preferences from '@/stores/tools/projectPreferences';
import { domainQueryKey, keywordQueryKey, keywordCountryKey, keywordLanguageKey, domainCountryKey, domainLanguageKey } from '@/stores/tools/storageKeys';

const initial = useProjectStore.getState();
beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({activeProjectId:'a', projects:[
    {id:'a',name:'Polish',rootUrl:'https://example.pl/path',createdAt:'2026-01-01',lastOpenedAt:'2026-01-01'},
    {id:'b',name:'German',rootUrl:'https://example.de',createdAt:'2026-01-01',lastOpenedAt:'2026-01-01'},
  ]});
});
afterEach(() => {vi.restoreAllMocks(); useProjectStore.setState(initial);});

describe('public project preference contracts', () => {
  it('keeps credential and preference namespaces stable and separated by project', () => {
    expect(preferences.backlinkGapSettingsKey('a')).toBe('seomi_backlink_gap_settings_a');
    expect(preferences.gscClientIdKey('a')).toBe('seomi_gsc_client_id_a');
    expect(preferences.gscClientSecretKey('a')).toBe('gsc_client_secret_a');
    expect(preferences.gscPropertyKey('a')).toBe('seomi_gsc_property_a');
    expect(preferences.gscFiltersKey('a')).toBe('seomi_gsc_filters_a_v1');
    expect(preferences.gscFiltersKey('b')).not.toBe(preferences.gscFiltersKey('a'));
  });

  it('returns independent empty filters for absent, corrupt, scalar and null records', () => {
    for (const raw of [null,'{','null','5','"text"']) {
      if (raw === null) localStorage.removeItem(preferences.gscFiltersKey('a'));
      else localStorage.setItem(preferences.gscFiltersKey('a'),raw);
      const filters = preferences.readGscFilters('a');
      expect(filters).toEqual({});
      expect(filters).not.toBe(preferences.DEFAULT_GSC_FILTERS);
    }
  });

  it('normalizes GSC country and rejects malformed field types without affecting other projects', () => {
    localStorage.setItem(preferences.gscFiltersKey('a'),JSON.stringify({search_type:'web',device:'mobile',country:' POL ',extra:true}));
    expect(preferences.readGscFilters('a')).toEqual({search_type:'web',device:'MOBILE',country:'pol'});
    localStorage.setItem(preferences.gscFiltersKey('b'),JSON.stringify({search_type:42,device:null,country:12}));
    expect(preferences.readGscFilters('b')).toEqual({});
  });

  it('drops invalid GSC enum values and country names instead of fabricating country codes', () => {
    for (const country of ['POLAND','pl','123','pøl','']) {
      localStorage.setItem(preferences.gscFiltersKey('a'),JSON.stringify({search_type:'invalid',device:'phone',country}));
      expect(preferences.readGscFilters('a')).toEqual({});
    }
    localStorage.setItem(preferences.gscFiltersKey('a'),JSON.stringify({search_type:' googleNews ',device:' tablet ',country:' DEU '}));
    expect(preferences.readGscFilters('a')).toEqual({search_type:'googleNews',device:'TABLET',country:'deu'});
  });

  it('resolves real project roots and preserves readable legacy invalid roots', () => {
    expect(preferences.projectRootDomain('a')).toBe('example.pl');
    expect(preferences.projectRootDomain('missing')).toBe('');
    useProjectStore.setState({projects:[{...initial.projects[0],id:'legacy',name:'Legacy',rootUrl:'  invalid root  ',createdAt:'2026-01-01',lastOpenedAt:'2026-01-01'}]});
    expect(preferences.projectRootDomain('legacy')).toBe('invalid root');
  });

  it('selects configured markets, then a supported root TLD, then the documented default', () => {
    expect(preferences.projectDefaultMarket('a')).toBe('PL');
    expect(preferences.projectDefaultMarket('b')).toBe('DE');
    expect(preferences.projectDefaultMarket('missing')).toBe('US');
    localStorage.setItem('seomi_project_a_dataforseo_market_v1','FR');
    expect(preferences.projectDefaultMarket('a')).toBe('FR');
    localStorage.setItem('seomi_project_a_dataforseo_market_v1','unsupported');
    expect(preferences.projectDefaultMarket('a')).toBe('PL');
  });

  it('preserves intentionally cleared queries and trims only on save', () => {
    expect(preferences.loadProjectQuery(domainQueryKey,'a')).toBe('example.pl');
    preferences.saveProjectQuery(domainQueryKey,'  user.example  ');
    expect(preferences.loadProjectQuery(domainQueryKey,'a')).toBe('user.example');
    preferences.saveProjectQuery(domainQueryKey,'','a');
    expect(preferences.loadProjectQuery(domainQueryKey,'a')).toBe('');
    expect(preferences.loadProjectQuery(domainQueryKey,'b')).toBe('example.de');
    useProjectStore.setState({activeProjectId:null});
    preferences.saveProjectQuery(domainQueryKey,'orphan');
    expect(localStorage.getItem(domainQueryKey('a'))).toBe('');
  });

  it('keeps keyword queries empty until saved and isolated from domain queries', () => {
    expect(preferences.loadKeywordQuery('a')).toBe('');
    localStorage.setItem(keywordQueryKey('a'),'keyword fixture');
    expect(preferences.loadKeywordQuery('a')).toBe('keyword fixture');
    expect(preferences.loadKeywordQuery('b')).toBe('');
    expect(preferences.loadProjectQuery(domainQueryKey,'a')).toBe('example.pl');
  });

  it('restores keyword markets from codes and provider location IDs, falling back on invalid inputs', () => {
    expect(preferences.loadKeywordCountry('a')).toBe('PL');
    localStorage.setItem(keywordCountryKey('a'),'2276');
    expect(preferences.loadKeywordCountry('a')).toBe('DE');
    localStorage.setItem(keywordCountryKey('a'),'invalid');
    expect(preferences.loadKeywordCountry('a')).toBe('PL');
    expect(preferences.loadKeywordCountry('b')).toBe('DE');
  });

  it('validates keyword language against the selected market rather than accepting arbitrary values', () => {
    expect(preferences.loadKeywordLanguage('a')).toBe('pl');
    localStorage.setItem(keywordLanguageKey('a'),'invalid');
    expect(preferences.loadKeywordLanguage('a')).toBe('pl');
    localStorage.setItem(keywordCountryKey('a'),'US');
    localStorage.setItem(keywordLanguageKey('a'),' EN ');
    expect(preferences.loadKeywordLanguage('a')).toBe('en');
  });

  it('restores domain market and language independently from keyword settings', () => {
    expect(preferences.loadDomainCountry('a')).toBe('PL');
    expect(preferences.loadDomainLanguage('a')).toBe('pl');
    localStorage.setItem(domainCountryKey('a'),'DE');
    localStorage.setItem(domainLanguageKey('a'),' DE ');
    expect(preferences.loadDomainCountry('a')).toBe('DE');
    expect(preferences.loadDomainLanguage('a')).toBe('de');
    expect(preferences.loadKeywordCountry('a')).toBe('PL');
    localStorage.setItem(domainCountryKey('a'),'invalid');
    expect(preferences.loadDomainCountry('a')).toBe('PL');
  });

  it('bounds competitor inputs and discards non-string entries while retaining explicit false', () => {
    expect(preferences.loadBacklinkGapSettings('a')).toEqual({competitors:[],includeSubdomains:true});
    localStorage.setItem(preferences.backlinkGapSettingsKey('a'),JSON.stringify({competitors:['one.example',null,12,'two.example'],includeSubdomains:false}));
    expect(preferences.loadBacklinkGapSettings('a')).toEqual({competitors:['one.example','two.example'],includeSubdomains:false});
    localStorage.setItem(preferences.backlinkGapSettingsKey('b'),JSON.stringify({competitors:'bad',includeSubdomains:'false'}));
    expect(preferences.loadBacklinkGapSettings('b')).toEqual({competitors:[],includeSubdomains:true});
    localStorage.setItem(preferences.backlinkGapSettingsKey('a'),JSON.stringify({competitors:Array.from({length:25},(_,i)=>`c${i}.example`)}));
    expect(preferences.loadBacklinkGapSettings('a').competitors).toHaveLength(19);
  });

  it('saves bounded competitors to the currently selected project and skips orphan writes', () => {
    preferences.saveBacklinkGapSettings(Array.from({length:25},(_,i)=>`c${i}.example`),false);
    expect(preferences.loadBacklinkGapSettings('a').competitors).toHaveLength(19);
    expect(preferences.loadBacklinkGapSettings('a').includeSubdomains).toBe(false);
    useProjectStore.setState({activeProjectId:'b'});
    preferences.saveBacklinkGapSettings(['new.example'],true);
    expect(preferences.loadBacklinkGapSettings('b')).toEqual({competitors:['new.example'],includeSubdomains:true});
    useProjectStore.setState({activeProjectId:null});
    const count=localStorage.length;
    preferences.saveBacklinkGapSettings(['orphan.example'],false);
    expect(localStorage.length).toBe(count);
  });
});
