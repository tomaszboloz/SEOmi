import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BrandPolicyInput, SiteFocusReport } from '@/services/siteFocus';
import { parseBrandInput } from '@/services/siteFocusMonitoring/brand';
import { can } from '@/services/team/roles';
import { readIdentity } from '@/services/team/identity';
import { deniedMessage, enforcePermission } from '@/services/team/enforce';

export interface BrandPolicyPanelProps {
  report: Pick<SiteFocusReport, 'brandFilter'>;
  /** Saved dictionary; undefined or empty when none. */
  saved: BrandPolicyInput | undefined;
  /** False without a project: the dictionary is a per-project setting and cannot be stored. */
  persisted: boolean;
  onSave: ((policy: BrandPolicyInput) => void) | undefined;
}

type Field = 'aliases' | 'competitors' | 'exceptions';
const FIELDS: Field[] = ['aliases', 'competitors', 'exceptions'];
const inputClass = 'rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400';

/** Per-project brand dictionary (#56) and the competitor terms it hid from the gap list, with the reason. */
export const BrandPolicyPanel = ({ report, saved, persisted, onSave }: BrandPolicyPanelProps) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Record<Field, string>>(() => ({
    aliases: (saved?.aliases ?? []).join('\n'), competitors: (saved?.competitors ?? []).join('\n'), exceptions: (saved?.exceptions ?? []).join('\n'),
  }));
  const allowed = can(readIdentity().role, 'modify_site_focus_rules');
  const editable = allowed && persisted && !!onSave;
  const filter = report.brandFilter;

  const save = () => {
    if (!onSave || !enforcePermission('modify_site_focus_rules')) return;
    onSave(Object.fromEntries(FIELDS.map((field) => [field, parseBrandInput(draft[field])])));
  };

  return (
    <section aria-labelledby="focus-brand-title" className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 id="focus-brand-title" className="text-sm font-semibold text-slate-200">{t('focus.brand.title')}</h2>
      <p className="text-xs text-slate-400">{t('focus.brand.help')}</p>
      {FIELDS.map((field) => (
        <label key={field} className="flex flex-col gap-1 text-xs text-slate-300">
          {t(`focus.brand.${field}`)}
          <textarea rows={2} value={draft[field]} readOnly={!editable} className={inputClass}
            onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))} />
        </label>
      ))}
      <button type="button" onClick={save} disabled={!editable}
        className="rounded border border-slate-600 px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
        {t('focus.brand.save')}
      </button>
      {!persisted && <p role="note" className="text-xs text-amber-200">{t('focus.brand.needsProject')}</p>}
      {!allowed && <p role="note" className="text-xs text-amber-200">{deniedMessage()}</p>}
      {filter && filter.ownBrand.length > 0 && (
        <p className="text-xs text-slate-400" data-testid="focus-brand-own">{t('focus.brand.ownBrand', { terms: filter.ownBrand.join(', ') })}</p>
      )}
      {filter && filter.filteredGaps.length > 0 && (
        <div role="status" data-testid="focus-brand-filtered">
          <h3 className="text-xs font-semibold text-slate-300">{t('focus.brand.filteredTitle')}</h3>
          <ul className="list-disc pl-4 text-xs text-slate-400">
            {filter.filteredGaps.map((item) => (
              <li key={`${item.reason}:${item.term}`}>{t('focus.brand.filtered', { term: item.term, reason: t(`focus.brand.reason.${item.reason}`) })}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
