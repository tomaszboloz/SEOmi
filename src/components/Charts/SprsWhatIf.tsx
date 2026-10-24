import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { simulateWhatIf, type SprsEdge, type WhatIfRow } from '@/services/semanticGraph/sprs';

const MAX_ROWS = 10;
type Action = 'add' | 'remove';

/** What-If link simulator: runs on the frozen graph given to it and never mutates it. */
export const SprsWhatIf = ({ nodes, edges }: { nodes: Array<{ id: string }>; edges: SprsEdge[] }) => {
  const { t } = useTranslation();
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [action, setAction] = useState<Action>('add');
  const [rows, setRows] = useState<WhatIfRow[] | null>(null);
  const existing = useMemo(() => edges.some((edge) => edge.source === source && edge.target === target), [edges, source, target]);
  const invalid = !source || !target || source === target || (action === 'add' ? existing : !existing);

  const run = () => {
    const change = action === 'add' ? { add: [{ source, target, links: 1 }] } : { remove: [{ source, target }] };
    setRows(simulateWhatIf(nodes, edges, change));
  };

  if (nodes.length < 2) return null;
  return (
    <section aria-label={t('sprsUi.whatIf.title')} className="space-y-2 text-xs text-slate-200">
      <h5 className="font-semibold">{t('sprsUi.whatIf.title')}</h5>
      <div className="grid gap-2 sm:grid-cols-4">
        <select aria-label={t('sprsUi.whatIf.source')} value={source} onChange={(event) => { setSource(event.target.value); setRows(null); }} className="h-8 rounded border border-slate-700 bg-slate-950 px-1">
          <option value="">{t('sprsUi.whatIf.source')}</option>
          {nodes.map((node) => <option key={node.id} value={node.id}>{node.id}</option>)}
        </select>
        <select aria-label={t('sprsUi.whatIf.target')} value={target} onChange={(event) => { setTarget(event.target.value); setRows(null); }} className="h-8 rounded border border-slate-700 bg-slate-950 px-1">
          <option value="">{t('sprsUi.whatIf.target')}</option>
          {nodes.map((node) => <option key={node.id} value={node.id}>{node.id}</option>)}
        </select>
        <select aria-label={t('sprsUi.whatIf.action')} value={action} onChange={(event) => { setAction(event.target.value as Action); setRows(null); }} className="h-8 rounded border border-slate-700 bg-slate-950 px-1">
          <option value="add">{t('sprsUi.whatIf.add')}</option>
          <option value="remove">{t('sprsUi.whatIf.remove')}</option>
        </select>
        <button type="button" disabled={invalid} onClick={run} className="h-8 rounded border border-emerald-500/40 px-2 text-emerald-300 disabled:opacity-40">{t('sprsUi.whatIf.run')}</button>
      </div>
      {rows && (rows.length === 0 ? <p role="status" className="text-slate-400">{t('sprsUi.whatIf.noChange')}</p> : (
        <table className="w-full text-left">
          <thead><tr><th>{t('sprsUi.page')}</th><th>{t('sprsUi.whatIf.before')}</th><th>{t('sprsUi.whatIf.after')}</th><th>{t('sprsUi.whatIf.delta')}</th></tr></thead>
          <tbody>{rows.slice(0, MAX_ROWS).map((row) => <tr key={row.nodeId}><td className="break-all">{row.nodeId}</td><td>{row.before}</td><td>{row.after}</td><td className={row.delta > 0 ? 'text-emerald-300' : 'text-rose-300'}>{row.delta > 0 ? '+' : ''}{row.delta}</td></tr>)}</tbody>
        </table>
      ))}
    </section>
  );
};
