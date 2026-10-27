import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import { createBriefDeps } from '@/services/siteFocusBenchmark/adapter';
import { proposePatch, decide, type PatchProvider, type PatchProposal, type PatchTarget } from '@/services/copilotPatcher';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';

type FailureKey = 'no-provider' | 'empty-response' | 'provider-error' | 'ownership' | 'unavailable';
type PanelState =
  | { kind: 'idle' | 'busy' }
  | { kind: 'proposal'; proposal: PatchProposal }
  | { kind: 'message'; tone: 'warning' | 'error'; key: FailureKey; detail?: string };

interface Props {
  target: PatchTarget;
  projectId?: string | null;
  index: number;
  /** Test and host override; production uses the selected existing AI runner. */
  providers?: PatchProvider[];
}

const button = 'rounded border border-slate-600 px-2 py-1 text-xs text-slate-100 hover:bg-slate-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400';

const reasonKey = (reason: 'no-provider' | 'empty-response' | 'provider-error'): FailureKey => reason;
const htmlFor = (text: string): string => `<p>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`;

export const CopilotPatcherPanel = ({ target, projectId, index, providers }: Props) => {
  const { t } = useTranslation();
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const selectedProvider = useAuthStore((state) => state.provider);
  const selectedConnected = useAuthStore((state) => state.connectionStatus[state.provider] === 'connected');
  const [state, setState] = useState<PanelState>({ kind: 'idle' });
  const controller = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  const targetKey = useMemo(() => JSON.stringify([
    target.h1, target.h2, target.heading, target.paragraph, target.language,
    target.pageEntities, target.missingEntities, target.removeFragments,
  ]), [target.h1, target.h2, target.heading, target.paragraph, target.language, target.pageEntities, target.missingEntities, target.removeFragments]);
  const ownsProject = (): boolean => Boolean(projectId?.trim()) && useProjectStore.getState().activeProjectId === projectId;
  const ownershipMessage = (): void => setState({ kind: 'message', tone: 'warning', key: 'ownership' });

  useEffect(() => {
    controller.current?.abort();
    requestId.current += 1;
    setState({ kind: 'idle' });
    return () => { controller.current?.abort(); requestId.current += 1; };
  }, [activeProjectId, projectId, targetKey]);

  const cancel = (): void => {
    controller.current?.abort();
    requestId.current += 1;
    setState({ kind: 'idle' });
  };

  const generate = async (): Promise<void> => {
    if (!ownsProject()) {
      ownershipMessage();
      return;
    }
    if (!target.paragraph.trim()) {
      setState({ kind: 'message', tone: 'warning', key: 'unavailable' });
      return;
    }
    controller.current?.abort();
    const own = new AbortController();
    const id = ++requestId.current;
    controller.current = own;
    setState({ kind: 'busy' });
    const configured = providers ?? (selectedConnected ? [{
      id: selectedProvider,
      transport: 'cloud' as const,
      generate: createBriefDeps().generateText,
    }] : []);
    const result = await proposePatch(target, configured, { signal: own.signal });
    if (own.signal.aborted || requestId.current !== id || !ownsProject()) return;
    if (result.ok) setState({ kind: 'proposal', proposal: result.proposal });
    else if (result.reason !== 'aborted') setState({ kind: 'message', tone: result.reason === 'provider-error' ? 'error' : 'warning', key: reasonKey(result.reason), detail: result.detail });
  };

  const decideProposal = (proposal: PatchProposal, approved: boolean): void => {
    if (!ownsProject()) { ownershipMessage(); return; }
    setState({ kind: 'proposal', proposal: decide(proposal, approved) });
  };

  const copy = async (text: string): Promise<void> => {
    if (!ownsProject()) {
      ownershipMessage();
      return;
    }
    const clipboard = navigator.clipboard;
    if (!clipboard) return;
    if (typeof clipboard.write === 'function' && typeof ClipboardItem !== 'undefined') {
      try {
        await clipboard.write([new ClipboardItem({ 'text/plain': new Blob([text], { type: 'text/plain' }), 'text/html': new Blob([htmlFor(text)], { type: 'text/html' }) })]);
        return;
      } catch { /* fall back to plain text */ }
    }
    try { await clipboard.writeText(text); } catch { /* clipboard permission is optional */ }
  };
  const proposal = state.kind === 'proposal' ? state.proposal : undefined;

  return (
    <section className="space-y-2 rounded-lg border border-cyan-500/25 bg-cyan-500/5 p-3" data-testid="copilot-patcher">
      <h4 className="flex items-center gap-1 text-xs font-semibold text-cyan-100">{t('copilotPatcherUi.title')} <HelpTip id="aio.aioReadiness" /></h4>
      <p className="text-[11px] leading-5 text-slate-400">{t('copilotPatcherUi.description')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={button} disabled={state.kind === 'busy'} onClick={() => void generate()} aria-label={`${t('copilotPatcherUi.generate')} ${index + 1}`}>
          {state.kind === 'busy' ? t('copilotPatcherUi.generating') : t('copilotPatcherUi.generate')}
        </button>
        {state.kind === 'busy' && <button type="button" className={button} onClick={cancel}>{t('copilotPatcherUi.cancel')}</button>}
      </div>
      {state.kind === 'message' && <p role={state.tone === 'error' ? 'alert' : 'status'} className={state.tone === 'error' ? 'text-rose-300' : 'text-amber-200'}>{t(`copilotPatcherUi.${state.key}`, { message: state.detail ?? '' })}</p>}
      {proposal && (
        <div className="space-y-2 rounded border border-slate-700 bg-slate-950/60 p-2" data-testid="copilot-patch-proposal">
          <p className="text-[11px] font-semibold text-slate-300">{t('copilotPatcherUi.before')}</p>
          <p className="whitespace-pre-line text-[11px] text-slate-400">{proposal.before}</p>
          <p className="text-[11px] font-semibold text-emerald-200">{t('copilotPatcherUi.after')}</p>
          <p className="whitespace-pre-line text-[11px] text-slate-100">{proposal.after}</p>
          {proposal.status === 'pending' && <p role="status" className="text-[11px] text-amber-200">{t('copilotPatcherUi.pending')}</p>}
          {proposal.rejectedSentences.length > 0 && <p role="status" className="text-[11px] text-amber-200">{t('copilotPatcherUi.factGate', { count: proposal.rejectedSentences.length })}</p>}
          <p role="note" className="text-[11px] text-slate-400">{proposal.leftDevice ? t('copilotPatcherUi.remote') : t('copilotPatcherUi.local')}</p>
          {proposal.status === 'pending' && <div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={() => decideProposal(proposal, true)}>{t('copilotPatcherUi.approve')}</button><button type="button" className={button} onClick={() => decideProposal(proposal, false)}>{t('copilotPatcherUi.reject')}</button></div>}
          {proposal.status === 'approved' && <div className="flex flex-wrap items-center gap-2"><p role="status" className="text-[11px] text-emerald-200">{t('copilotPatcherUi.approved')}</p><button type="button" className={button} onClick={() => void copy(proposal.after)}>{t('copilotPatcherUi.copy')}</button></div>}
          {proposal.status === 'rejected' && <p role="status" className="text-[11px] text-slate-400">{t('copilotPatcherUi.rejected')}</p>}
        </div>
      )}
      <p className="text-[10px] text-slate-500">{t('copilotPatcherUi.keyboard')}</p>
    </section>
  );
};
