import {afterEach,expect,it,vi} from 'vitest';
import {resolveDataForSeoMarket,requireDataForSeoMarket,dataForSeoMarketByLocation,dataForSeoMarketLabel,dataForSeoLanguageLabel,DataForSeoRequestError} from '@/services/dataforseo';
import i18n from '@/i18n';
afterEach(()=>vi.restoreAllMocks());

it('resolves canonical and legacy market identities without silently changing unsupported selections',()=>{
  expect(resolveDataForSeoMarket(' pl ')?.code).toBe('PL');
  expect(resolveDataForSeoMarket('2276')?.code).toBe('DE');
  expect(resolveDataForSeoMarket('United States')?.code).toBe('US');
  expect(resolveDataForSeoMarket('unsupported')).toBeNull();
  expect(()=>requireDataForSeoMarket('unsupported')).toThrow(i18n.t('runtimeErrors.dataforseo.marketRequired'));
  expect(requireDataForSeoMarket('PL').locationCode).toBe(2616);
  expect(dataForSeoMarketByLocation(2276).code).toBe('DE');
  expect(()=>dataForSeoMarketByLocation(-1)).toThrow();
});

it('uses the current locale for catalogue labels and preserves real catalogue values when Intl fails',()=>{
  const market=requireDataForSeoMarket('PL');
  const locale=(i18n.language||'en').replace('_','-');
  expect(dataForSeoMarketLabel(market)).toBe(new Intl.DisplayNames([locale],{type:'region'}).of('PL'));
  expect(dataForSeoLanguageLabel({code:'pl'})).toBe(new Intl.DisplayNames([locale],{type:'language'}).of('pl'));
  vi.spyOn(Intl,'DisplayNames').mockImplementation(()=>{throw new Error('unavailable');});
  expect(dataForSeoMarketLabel(market)).toBe(market.label);
  expect(dataForSeoLanguageLabel({code:'pl',label:'Polish catalogue'})).toBe('Polish catalogue');
  expect(dataForSeoLanguageLabel({code:'pl'})).toBe('pl');
});

it('preserves provider retry and quota evidence on the public request error contract',()=>{
  const ordinary=new DataForSeoRequestError('fixture');
  expect(ordinary).toBeInstanceOf(Error);
  expect(ordinary).toMatchObject({name:'DataForSeoRequestError',message:'fixture',status:null,retryable:false,quotaExceeded:false,retryAfterSeconds:null});
  const limited=new DataForSeoRequestError('limited',429,true,true,30);
  expect(limited).toMatchObject({status:429,retryable:true,quotaExceeded:true,retryAfterSeconds:30});
});
