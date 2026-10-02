import type { SearchConsoleSession } from './useSearchConsoleSession';
import type { GscPerformanceFilters } from '@/types';

export function SearchConsoleControls({ session }: { session: SearchConsoleSession }) {
  const { t, activeProjectId, gscProperties, gscProperty, gscFilters, gscData, setGscProperty, dateRangeError, updateFilter, handleSaveSnapshot, dateRange, setDateRange, trackerMessage } = session;
  return <>
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs text-slate-300">{t('searchConsole.startDate')}
                <input aria-label={t('searchConsole.startDateAria')} type="date" value={dateRange.startDate} onChange={(event) => setDateRange((range) => ({ ...range, startDate: event.target.value }))} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-300">{t('searchConsole.endDate')}
                <input aria-label={t('searchConsole.endDateAria')} type="date" value={dateRange.endDate} onChange={(event) => setDateRange((range) => ({ ...range, endDate: event.target.value }))} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" />
              </label>
              <span className="text-xs text-slate-500">{t('searchConsole.dataFreshness')}</span>
              <button type="button" onClick={handleSaveSnapshot} disabled={!gscData || !activeProjectId || gscData.site_url !== gscProperty} className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200 disabled:opacity-40">{t('searchConsole.saveSnapshot')}</button>
            </div>
            <div className="grid gap-3 border-t border-slate-800 pt-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-xs text-slate-300">{t('searchConsoleFilters.searchType')}
                <select aria-label={t('searchConsole.searchTypeAria')} value={gscFilters.search_type || ''} onChange={(event) => updateFilter({ search_type: event.target.value ? event.target.value as GscPerformanceFilters['search_type'] : undefined })} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100">
                  <option value="">{t('searchConsoleFilters.allSearchTypes')}</option>
                  <option value="web">{t('searchConsoleFilters.web')}</option>
                  <option value="image">{t('searchConsoleFilters.image')}</option>
                  <option value="video">{t('searchConsoleFilters.video')}</option>
                  <option value="news">{t('searchConsoleFilters.news')}</option>
                  <option value="discover">{t('searchConsoleFilters.discover')}</option>
                  <option value="googleNews">{t('searchConsoleFilters.googleNews')}</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-300">{t('searchConsoleFilters.device')}
                <select aria-label={t('searchConsole.deviceAria')} value={gscFilters.device || ''} onChange={(event) => updateFilter({ device: event.target.value ? event.target.value as GscPerformanceFilters['device'] : undefined })} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100">
                  <option value="">{t('searchConsoleFilters.allDevices')}</option>
                  <option value="DESKTOP">{t('searchConsoleFilters.desktop')}</option>
                  <option value="MOBILE">{t('searchConsoleFilters.mobile')}</option>
                  <option value="TABLET">{t('searchConsoleFilters.tablet')}</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-300">{t('searchConsoleFilters.country')}
                <input aria-label={t('searchConsole.countryAria')} inputMode="text" autoCapitalize="characters" maxLength={3} pattern="[A-Za-z]{3}" placeholder={t('searchConsoleFilters.countryPlaceholder')} value={gscFilters.country || ''} onChange={(event) => updateFilter({ country: event.target.value.replace(/[^A-Za-z]/g, '').slice(0, 3).toLowerCase() || undefined })} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono uppercase text-slate-100 placeholder:normal-case" />
              </label>
            </div>
            <p className="text-[11px] text-slate-500">{t('searchConsoleFilters.scopeHint')}</p>
            {dateRangeError && <p role="alert" className="text-xs text-rose-300">{dateRangeError}</p>}
            {trackerMessage && <p role="status" className="text-xs text-emerald-300">{trackerMessage}</p>}
          </section>
          {gscProperties.length > 0 ? <label className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-300 sm:flex-row sm:items-center sm:justify-between">
            <span>{t('searchConsole.property')}</span>
            <select aria-label={t('searchConsole.selectedPropertyAria')} value={gscProperty} onChange={(event) => setGscProperty(event.target.value)} className="min-w-0 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100 sm:w-2/3">
              {gscProperties.map((property) => <option key={property.siteUrl} value={property.siteUrl}>{property.siteUrl} · {property.permissionLevel}</option>)}
            </select>
          </label> : <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-200">{t('searchConsole.noProperties')}</p>}
  </>;
}
