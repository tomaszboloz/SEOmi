import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ImageMetrics } from '@/components/Results/images/ImageMetrics';
import { ImageControls } from '@/components/Results/images/ImageControls';
import { ImageCard } from '@/components/Results/images/ImageCard';
import { ImageBadges } from '@/components/Results/images/ImageBadges';
import { LinkMetrics } from '@/components/Results/links/LinkMetrics';
import { LinkControls } from '@/components/Results/links/LinkControls';
import { LinkCard } from '@/components/Results/links/LinkCard';
import { LinkPagination } from '@/components/Results/links/LinkPagination';
import { useLinkVerification } from '@/components/Results/links/useLinkVerification';
import i18n from '@/i18n';
const invoke=vi.hoisted(()=>vi.fn());
vi.mock('@/services/tauri',()=>({invokeTauriCommand:invoke,isTauriEnvironment:()=>true}));
vi.mock('@/components/Results/ShowOnPageButton',()=>({ShowOnPageButton:()=>null}));
afterEach(()=>{cleanup();invoke.mockReset();});
const counts={total:3,missingAltCount:1,missingDimCount:2,modernCount:1};
const links={total_links:3,internal_links:1,external_links:2,nofollow_links:0,links:[]};
it('renders observed image metrics with their labels',()=>{
 render(<ImageMetrics {...counts} />);
 expect(screen.getByText(i18n.t('images.imagesFound')).parentElement?.textContent).toContain('3');
 expect(screen.getByText(i18n.t('images.missingAlt')).parentElement?.textContent).toContain('1');
 expect(screen.getByTitle(i18n.t('legacyUi.images.modernHintTitle')).textContent).toBe('1/3');
});
it('routes image edits and export to the supplied callbacks',()=>{
 const setSearch=vi.fn();const setFilter=vi.fn();const exportCsv=vi.fn();
 render(<ImageControls {...counts} legacyCount={2} filter="all" setFilter={setFilter} search="" setSearch={setSearch} exportCsv={exportCsv} />);
 fireEvent.change(screen.getByRole('textbox'),{target:{value:'coffee'}});expect(setSearch).toHaveBeenCalledWith('coffee');
 fireEvent.click(screen.getByRole('button',{name:i18n.t('legacyUi.images.modern',{count:1})}));expect(setFilter).toHaveBeenCalledWith('modern');
 fireEvent.click(screen.getByTitle(i18n.t('legacyUi.images.exportTitle')));expect(exportCsv).toHaveBeenCalledOnce();
});
it('renders an image card and routes copying its exact source URL',()=>{
 const copy=vi.fn();render(<ImageCard img={{src:'https://example.test/photo',has_alt:false}} pageUrl="https://example.test" copiedUrl={null} handleCopy={copy} />);
 expect(screen.getByText(i18n.t('legacyUi.images.missingAltWarning'))).toBeTruthy();
 fireEvent.click(screen.getByTitle(i18n.t('legacyUi.images.copyUrl')));expect(copy).toHaveBeenCalledWith('https://example.test/photo');
});
it('distinguishes decoded dimensions from absent dimensions in image badges',()=>{
 const view=render(<ImageBadges img={{src:'data:image/png;base64,fixture',format:'png',has_alt:true,width:'0',height:'0',dimensions_source:'intrinsic-data-uri'}} />);
 expect(screen.getByTitle(i18n.t('legacyUi.images.decodedDataUri')).textContent).toContain('0 × 0');
 view.rerender(<ImageBadges img={{src:'photo',has_alt:true}} />);expect(screen.getByText(i18n.t('legacyUi.images.missingDimensionsWarning'))).toBeTruthy();
});
it('renders actual link counters without deriving replacement counts',()=>{
 render(<LinkMetrics links={links} securityIssuesCount={2} />);
 expect(screen.getByText(i18n.t('links.totalLinks')).parentElement?.textContent).toContain('3');
 expect(screen.getByText(i18n.t('links.internal')).parentElement?.textContent).toContain('1');
});
it('routes link filter, batch, export and search controls',()=>{
 const setSearch=vi.fn();const setCurrentPage=vi.fn();const setFilterType=vi.fn();const batch=vi.fn();const exportCsv=vi.fn();
 render(<LinkControls links={links} securityIssuesCount={0} search="" setSearch={setSearch} setCurrentPage={setCurrentPage} filterType="all" setFilterType={setFilterType} isVerifyingBatch={false} pageCount={3} handleVerifyBatch={batch} exportCsv={exportCsv} />);
 fireEvent.change(screen.getByRole('textbox'),{target:{value:'needle'}});expect(setSearch).toHaveBeenCalledWith('needle');expect(setCurrentPage).toHaveBeenCalledWith(1);
 fireEvent.click(screen.getByRole('button',{name:i18n.t('legacyUi.links.external',{count:2})}));expect(setFilterType).toHaveBeenCalledWith('external');
 fireEvent.click(screen.getByRole('button',{name:i18n.t('legacyUi.links.verifyPage',{count:3})}));expect(batch).toHaveBeenCalledOnce();
 fireEvent.click(screen.getByTitle(i18n.t('legacyUi.links.exportTitle')));expect(exportCsv).toHaveBeenCalledOnce();
});
it('routes a link card check and renders observed error evidence',()=>{
 const check=vi.fn();const row={href:'https://example.test/link',text:'Observed',is_internal:true};
 const view=render(<LinkCard link={row} pageUrl="https://example.test" isPageHttps copiedUrl={null} handleCopy={vi.fn()} handleVerifySingleLink={check} />);
 fireEvent.click(screen.getByTitle(i18n.t('legacyUi.links.pingTitle')));expect(check).toHaveBeenCalledWith(row.href);
 view.rerender(<LinkCard link={row} pageUrl="https://example.test" isPageHttps copiedUrl={null} handleCopy={vi.fn()} handleVerifySingleLink={check} verified={{status:0,isBroken:false,error:'Actual check unavailable'}} />);
 expect(screen.getByText('Actual check unavailable')).toBeTruthy();expect(screen.queryByTitle(i18n.t('legacyUi.links.pingTitle'))).toBeNull();
});
it('disables backward pagination on the first page and bounds forward updates',()=>{
 const setPage=vi.fn();render(<LinkPagination startIndex={0} totalCount={51} currentSafePage={1} totalPages={2} setCurrentPage={setPage} />);
 expect((screen.getByTitle(i18n.t('legacyUi.links.previousPage')) as HTMLButtonElement).disabled).toBe(true);
 fireEvent.click(screen.getByTitle(i18n.t('legacyUi.links.nextPage')));expect(setPage.mock.calls[0][0](1)).toBe(2);expect(setPage.mock.calls[0][0](2)).toBe(2);
});
it('exposes pending check state then stores the returned native status',async()=>{
 let resolve!: (value:{status:number;is_broken:boolean})=>void;invoke.mockImplementation(()=>new Promise(done=>{resolve=done;}));
 const {result}=renderHook(()=>useLinkVerification());let pending!:Promise<void>;
 act(()=>{pending=result.current.handleVerifySingleLink('https://example.test');});expect(result.current.verifiedLinks['https://example.test'].checking).toBe(true);
 await act(async()=>{resolve({status:301,is_broken:false});await pending;});
 expect(result.current.verifiedLinks['https://example.test']).toEqual({status:301,isBroken:false,checking:false});
});
