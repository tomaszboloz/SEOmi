import { useTranslation } from 'react-i18next';
import type { MapNode } from './mapTypes';

/** Screen reader alternative to the canvas: every visible page as a sortable-by-source table. */
export const MapTable = ({ nodes, onSelect }: { nodes: MapNode[]; onSelect: (id: string) => void }) => {
  const { t } = useTranslation();
  const heads = ['colUrl', 'colStatus', 'colDepth', 'colInlinks', 'colTrs', 'colSection', 'colProblem'];
  return (
    <details className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40">
      <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-300">{t('mapUi.cy.tableSummary', { count: nodes.length })}</summary>
      <div className="max-h-72 overflow-auto px-3 pb-2">
        <table className="w-full text-left text-[11px] text-slate-300">
          <caption className="sr-only">{t('mapUi.cy.tableCaption')}</caption>
          <thead><tr>{heads.map((key) => <th key={key} scope="col" className="py-1 pr-3 font-medium text-slate-500">{t(`mapUi.cy.${key}`)}</th>)}</tr></thead>
          <tbody>
            {nodes.map((node) => (
              <tr key={node.id} className="border-t border-slate-800">
                <th scope="row" className="max-w-xs truncate py-1 pr-3 text-left font-normal"><button type="button" onClick={() => onSelect(node.id)} className="max-w-full truncate text-left font-mono text-emerald-200 hover:underline">{node.url}</button></th>
                <td className="pr-3">{node.status}</td>
                <td className="pr-3">{node.depth}</td>
                <td className="pr-3">{node.inlinks}</td>
                <td className="pr-3">{node.trs === null ? t('mapUi.cy.noTrs') : Math.round(node.trs)}</td>
                <td className="pr-3">{node.section}</td>
                <td>{node.problem ? t('mapUi.cy.yes') : t('mapUi.cy.no')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
};
