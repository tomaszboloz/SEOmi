import { useTranslation } from 'react-i18next';
import type { MapNode } from './mapTypes';

export const MapTooltip = ({ node, x, y }: { node: MapNode; x: number; y: number }) => {
  const { t } = useTranslation();
  return (
    <div role="tooltip" style={{ left: x + 12, top: y + 12 }} className="pointer-events-none absolute z-10 max-w-xs break-all rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-200 shadow-lg">
      <span className="font-mono">{node.url}</span>
      <span className="block text-slate-400">{t('mapUi.cy.tooltip', { status: node.status, depth: node.depth, inlinks: node.inlinks })}</span>
    </div>
  );
};

export const MapDetails = ({ node }: { node: MapNode | undefined }) => {
  const { t } = useTranslation();
  if (!node) return <p className="mt-3 text-xs text-slate-500" aria-live="polite">{t('mapUi.cy.detailsHint')}</p>;
  const rows: Array<[string, string | number]> = [
    [t('mapUi.cy.colStatus'), node.status],
    [t('mapUi.cy.colDepth'), node.depth],
    [t('mapUi.cy.colInlinks'), node.inlinks],
    [t('mapUi.cy.colTrs'), node.trs === null ? t('mapUi.cy.noTrs') : Math.round(node.trs)],
    [t('mapUi.cy.colSection'), node.section],
    [t('mapUi.cy.colProblem'), node.problem ? t('mapUi.cy.yes') : t('mapUi.cy.no')],
  ];
  return (
    <section aria-live="polite" aria-label={t('mapUi.cy.detailsTitle')} className="mt-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-xs">
      <h4 className="font-medium text-white">{t('mapUi.cy.detailsTitle')}</h4>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] sm:grid-cols-3">
        {rows.map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="text-slate-200">{value}</dd></div>)}
      </dl>
    </section>
  );
};
