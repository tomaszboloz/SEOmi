import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ImagesAudit } from '@/components/Results/ImagesAudit';
import { LinksAudit } from '@/components/Results/LinksAudit';
import { createAuditFixture } from './fixtures/audit';
import type { ImageData, LinkData } from '@/types';
import i18n from '@/i18n';
const mocks = vi.hoisted(() => ({ invoke:vi.fn(), copy:vi.fn(), images:vi.fn(), links:vi.fn(), problems:false, native:true }));
vi.mock('@/services/tauri', () => ({invokeTauriCommand:mocks.invoke,isTauriEnvironment:()=>mocks.native}));
vi.mock('@/services/clipboard', () => ({copyText:mocks.copy}));
vi.mock('@/services/export', () => ({downloadAuditImagesCsv:mocks.images,downloadAuditLinksCsv:mocks.links}));
vi.mock('@/stores/auditStore', () => ({useAuditStore:(selector:(state:{showOnlyProblems:boolean})=>unknown)=>selector({showOnlyProblems:mocks.problems})}));
vi.mock('@/components/Results/ShowOnPageButton', () => ({ShowOnPageButton:()=>null}));
beforeEach(()=>{mocks.problems=false;mocks.native=true;for(const mock of [mocks.invoke,mocks.copy,mocks.images,mocks.links])mock.mockReset();mocks.copy.mockResolvedValue(true);});
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks();});
const link = (text:string, patch:Partial<LinkData>={}):LinkData => ({href:`https://example.test/${text}`,text,is_internal:true,...patch});
const image = (src:string, patch:Partial<ImageData>={}):ImageData => ({src,alt:'Visible alt',has_alt:true,width:"100",height:"80",...patch});
const linksAudit = (rows:LinkData[]) => createAuditFixture({links:{total_links:rows.length,internal_links:rows.filter(row=>row.is_internal).length,external_links:rows.filter(row=>!row.is_internal).length,nofollow_links:0,links:rows}});
const click = (key:string,args:Record<string,unknown>={}) => fireEvent.click(screen.getByRole('button',{name:i18n.t(key,args)}));

it('treats rel as case-insensitive tokens, not substrings, in security filters',()=>{
  render(<LinksAudit audit={linksAudit([link('safe',{target:'_blank',rel:'NOOPENER NOFOLLOW'}),link('lookalike',{target:'_blank',rel:'xnoopener'}),link('unsafe',{target:'_blank'})])} />);
  click('legacyUi.links.risks',{count:2});
  expect(screen.queryByText('safe',{exact:true})).toBeNull();
  expect(screen.getByText('lookalike',{exact:true})).toBeTruthy();expect(screen.getByText('unsafe',{exact:true})).toBeTruthy();
});
it('does not treat a rel substring as a nofollow directive',()=>{
  render(<LinksAudit audit={linksAudit([link('actual',{rel:'NOFOLLOW sponsored'}),link('substring',{rel:'xnofollow'})])} />);
  click('legacyUi.links.nofollow',{count:0});
  expect(screen.getByText('actual',{exact:true})).toBeTruthy();expect(screen.queryByText('substring',{exact:true})).toBeNull();
});
it.each(['images','links'] as const)('trims the %s search input before comparing visible evidence',kind=>{
  render(kind==='images'?<ImagesAudit audit={createAuditFixture({images:[image('https://example.test/coffee.png')]})} />:<LinksAudit audit={linksAudit([link('Coffee')])} />);
  fireEvent.change(screen.getByRole('textbox'),{target:{value:'  coffee  '}});
  expect(screen.getByText(kind==='images'?'https://example.test/coffee.png':'Coffee',{exact:true})).toBeTruthy();
});


it.each([
 ['missingAlt','missing', {has_alt:false}],
 ['missingDimensions','missing', {width:undefined}],
 ['legacy','missing', {format:'jpeg'}],
 ['modern','missing', {format:'webp'}],
] as const)('filters image evidence through %s and can restore all rows', (key,name,patch) => {
 const audit=createAuditFixture({images:[image(`https://example.test/${name}`,patch),image('https://example.test/other',{format:'bmp'})]});
 render(<ImagesAudit audit={audit} />); click(`legacyUi.images.${key}`,{count:1});
 expect(screen.getByText(`https://example.test/${name}`,{exact:true})).toBeTruthy();
 expect(screen.queryByText('https://example.test/other',{exact:true})).toBeNull();
 click('legacyUi.images.all',{count:2}); expect(screen.getByText('https://example.test/other',{exact:true})).toBeTruthy();
});
it('exports the full source image audit and handles thumbnail failure',()=>{
 const audit=createAuditFixture({images:[image('https://example.test/coffee')]});
 render(<ImagesAudit audit={audit} />); const thumbnail=screen.getByRole('img'); fireEvent.error(thumbnail);
 expect((thumbnail as HTMLImageElement).style.display).toBe('none');
 fireEvent.click(screen.getByTitle(i18n.t('legacyUi.images.exportTitle')));expect(mocks.images).toHaveBeenCalledExactlyOnceWith(audit);
});
it('copies an image URL only after successful clipboard completion and resets the indicator',async()=>{
 vi.useFakeTimers(); render(<ImagesAudit audit={createAuditFixture({images:[image('https://example.test/a')]})} />);
 const button=screen.getByTitle(i18n.t('legacyUi.images.copyUrl'));
 mocks.copy.mockResolvedValueOnce(false); await act(async()=>{fireEvent.click(button);});expect(button.querySelector('.lucide-check')).toBeNull();
 await act(async()=>{fireEvent.click(button);});expect(button.querySelector('.lucide-check')).toBeTruthy();
 expect(mocks.copy).toHaveBeenLastCalledWith('https://example.test/a');
 act(()=>vi.advanceTimersByTime(1500));expect(button.querySelector('.lucide-check')).toBeNull();
});
it('shows only problem images and preserves actual dimension and responsive evidence',()=>{
 mocks.problems=true;
 render(<ImagesAudit audit={createAuditFixture({images:[image('https://example.test/healthy'),image('https://example.test/issue',{has_alt:false,dimensions_source:'mixed',srcset:'https://example.test/large 2x',loading:'lazy'})]})} />);
 expect(screen.queryByText('https://example.test/healthy',{exact:true})).toBeNull();expect(screen.getByText('https://example.test/issue',{exact:true})).toBeTruthy();
 expect(screen.getByTitle(i18n.t('legacyUi.images.mixedDataUri')).textContent).toContain('100 × 80');
 expect(screen.getByText(i18n.t('legacyUi.images.responsive'))).toBeTruthy();
});
it('renders an explicit empty image state after an unmatched search',()=>{
 render(<ImagesAudit audit={createAuditFixture({images:[image('https://example.test/a')]})} />);
 fireEvent.change(screen.getByRole('textbox'),{target:{value:'absent'}});expect(screen.getByText(i18n.t('legacyUi.images.empty'))).toBeTruthy();
});
it('filters internal/external links and exports original evidence',()=>{
 const audit=linksAudit([link('inside'),link('outside',{is_internal:false})]);render(<LinksAudit audit={audit} />);
 click('legacyUi.links.external',{count:1});expect(screen.queryByText('inside',{exact:true})).toBeNull();expect(screen.getByText('outside',{exact:true})).toBeTruthy();
 click('legacyUi.links.internal',{count:1});expect(screen.getByText('inside',{exact:true})).toBeTruthy();expect(screen.queryByText('outside',{exact:true})).toBeNull();
 fireEvent.click(screen.getByTitle(i18n.t('legacyUi.links.exportTitle')));expect(mocks.links).toHaveBeenCalledExactlyOnceWith(audit);
});
it('paginates fifty links at a time and resets the page when search changes',()=>{
 render(<LinksAudit audit={linksAudit(Array.from({length:51},(_,index)=>link(`row-${index}`)))} />);
 expect(screen.queryByText('row-50',{exact:true})).toBeNull();fireEvent.click(screen.getByTitle(i18n.t('legacyUi.links.nextPage')));
 expect(screen.getByText('row-50',{exact:true})).toBeTruthy();expect(screen.queryByText('row-0',{exact:true})).toBeNull();
 fireEvent.click(screen.getByTitle(i18n.t('legacyUi.links.previousPage')));expect(screen.getByText('row-0',{exact:true})).toBeTruthy();
 fireEvent.change(screen.getByRole('textbox'),{target:{value:'row-50'}});expect(screen.getByText('row-50',{exact:true})).toBeTruthy();
});
it('keeps desktop-only bridge failure distinct from broken HTTP evidence',async()=>{
 mocks.native=false;mocks.invoke.mockRejectedValue(new Error('no bridge'));
 render(<LinksAudit audit={linksAudit([link('observed')])} />);fireEvent.click(screen.getByTitle(i18n.t('legacyUi.links.pingTitle')));
 expect(await screen.findByText(i18n.t('runtimeErrors.tauri.desktopOnly'))).toBeTruthy();
 expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith('check_link',{url:'https://example.test/observed'});
});
it('preserves actual HTTP status and native failure evidence',async()=>{
 mocks.invoke.mockResolvedValueOnce({status:404,is_broken:true}).mockRejectedValueOnce(new Error('offline'));
 render(<LinksAudit audit={linksAudit([link('broken'),link('unavailable')])} />);
 fireEvent.click(screen.getAllByTitle(i18n.t('legacyUi.links.pingTitle'))[0]);expect(await screen.findByText(i18n.t('crawl.ui.httpStatus',{status:404}))).toBeTruthy();
 fireEvent.click(screen.getByTitle(i18n.t('legacyUi.links.pingTitle')));expect(await screen.findByText(i18n.t('legacyUi.links.offline'))).toBeTruthy();
});
it('bounds batch verification to twenty-five visible links and skips already checked URLs',async()=>{
 mocks.invoke.mockResolvedValue({status:200,is_broken:false});
 render(<LinksAudit audit={linksAudit(Array.from({length:30},(_,index)=>link(`row-${index}`)))} />);
 click('legacyUi.links.verifyPage',{count:30});await waitFor(()=>expect(mocks.invoke).toHaveBeenCalledTimes(25));
 await waitFor(()=>expect((screen.getByRole('button',{name:i18n.t('legacyUi.links.verifyPage',{count:30})}) as HTMLButtonElement).disabled).toBe(false));
 click('legacyUi.links.verifyPage',{count:30});await act(async()=>{await Promise.resolve();});expect(mocks.invoke).toHaveBeenCalledTimes(25);
});
