import {act,fireEvent,render,screen} from '@testing-library/react';
import {it,expect,vi} from 'vitest';
import {RenderWorkerPanel} from '@/components/Settings/RenderWorkerPanel';
import {getRenderWorkerStatus,isTauriEnvironment,startRenderWorker,stopRenderWorker} from '@/services/tauri';
import i18n from '@/i18n';
vi.mock('@/services/tauri',()=>({getRenderWorkerStatus:vi.fn(),isTauriEnvironment:vi.fn(),startRenderWorker:vi.fn(),stopRenderWorker:vi.fn()}));
it('retains explicit stopped outcome when a status probe begun during stop resolves in the same React batch',async()=>{
 await i18n.changeLanguage('en');vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-25T08:00:00Z'));
 let finishStop!:()=>void;let finishProbe!:(active:boolean)=>void;let count=0;
 vi.mocked(isTauriEnvironment).mockReturnValue(true);
 vi.mocked(getRenderWorkerStatus).mockImplementation(()=>{count++;if(count===1)return Promise.resolve(false);if(count===2)return Promise.resolve(true);return new Promise(resolve=>{finishProbe=resolve;});});
 vi.mocked(startRenderWorker).mockResolvedValue({baseUrl:'http://127.0.0.1',token:'audit-token',version:'fixture',expiresAt:new Date(Date.now()+60000).toISOString(),oneShot:true});
 vi.mocked(stopRenderWorker).mockImplementation(()=>new Promise(resolve=>{finishStop=resolve;}));
 render(<RenderWorkerPanel/>);await act(async()=>{await Promise.resolve();});
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:i18n.t('legacyUi.renderWorker.start')}));await Promise.resolve();});
 expect(screen.getByText('audit-token')).toBeTruthy();
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:i18n.t('legacyUi.renderWorker.stop')}));await Promise.resolve();});
 await act(async()=>{await vi.advanceTimersByTimeAsync(5000);});expect(finishProbe).toBeTypeOf('function');
 await act(async()=>{finishStop();finishProbe(false);await Promise.resolve();});
 try{expect(screen.getByRole('status').textContent).toBe(i18n.t('legacyUi.renderWorker.stopped'));}finally{vi.useRealTimers();}
});
