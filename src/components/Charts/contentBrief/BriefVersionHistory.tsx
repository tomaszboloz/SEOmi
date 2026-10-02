import { useTranslation } from 'react-i18next';
import type { BriefModel } from './model';
import { useState } from 'react';
import { compareDrafts, saveDraftVersion } from '@/services/contentBrief';
import { inputClass } from './primitives';

export const BriefVersionHistory = ({ model }: { model: BriefModel }) => {
  const { t } = useTranslation();
  const { brief, onUpdate } = model;
  const [versionNote, setVersionNote] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const selectedVersion = brief.draftVersions.find((version) => version.id === selectedVersionId) ?? null;
  const selectedVersionDiff = selectedVersion ? compareDrafts(selectedVersion.draftMarkdown, brief.draftMarkdown) : null;
  const persistDraftVersion = () => {
    const next = saveDraftVersion(brief, versionNote);
    if (next !== brief) {
      onUpdate(next);
      setSelectedVersionId(next.draftVersions[0]?.id ?? '');
      setVersionNote('');
    }
  };
  const restoreDraftVersion = () => {
    if (!selectedVersion || selectedVersion.draftMarkdown === brief.draftMarkdown) return;
    onUpdate({ ...brief, draftMarkdown: selectedVersion.draftMarkdown });
  };
  return (
      <section aria-label={t('contentBrief.versionHistoryAria')} className="mt-3 rounded-lg border border-slate-800 bg-slate-950/35 p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h5 className="text-[10px] font-semibold text-slate-300">{t('contentBrief.versionHistoryTitle')}</h5>
            <p className="mt-1 max-w-2xl text-[9px] leading-4 text-slate-600">{t('contentBrief.versionHistoryDescription')}</p>
          </div>
          <span className="font-mono text-[10px] text-slate-500">{t('contentBrief.versionCount', { count: brief.draftVersions.length })}</span>
        </div>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 text-[9px] text-slate-500">{t('contentBrief.versionNote')}
            <input aria-label={t('contentBrief.versionNoteAria')} maxLength={240} value={versionNote} onChange={(event) => setVersionNote(event.target.value)} className={inputClass} placeholder={t('contentBrief.versionNotePlaceholder')} />
          </label>
          <button type="button" aria-label={t('contentBrief.saveVersion')} disabled={!brief.draftMarkdown.trim()} onClick={persistDraftVersion} className="h-9 rounded border border-sky-500/30 px-3 text-[10px] font-semibold text-sky-200 hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-40">{t('contentBrief.saveVersion')}</button>
        </div>
        {brief.draftVersions.length > 0 && <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 text-[9px] text-slate-500">{t('contentBrief.compareVersion')}
            <select aria-label={t('contentBrief.diffAria')} value={selectedVersionId} onChange={(event) => setSelectedVersionId(event.target.value)} className={inputClass}>
              <option value="">{t('contentBrief.chooseCheckpoint')}</option>
              {brief.draftVersions.map((version) => <option key={version.id} value={version.id}>{new Date(version.savedAt).toLocaleString()} · {version.note || t('contentBrief.noNote')}</option>)}
            </select>
          </label>
          <button type="button" aria-label={t('contentBrief.restoreVersion')} disabled={!selectedVersion || selectedVersion.draftMarkdown === brief.draftMarkdown} onClick={restoreDraftVersion} className="h-9 rounded border border-amber-500/30 px-3 text-[10px] font-semibold text-amber-200 hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-40">{t('contentBrief.restoreVersion')}</button>
        </div>}
        {selectedVersionDiff && <div role="status" aria-label={t('contentBrief.diffAria')} className="mt-2 rounded border border-slate-800 bg-slate-950/60 p-2 text-[9px] text-slate-400">
          <p>{t('contentBrief.diffAgainst', { added: selectedVersionDiff.addedLineCount, removed: selectedVersionDiff.removedLineCount, addedChars: selectedVersionDiff.addedCharacterCount, removedChars: selectedVersionDiff.removedCharacterCount })}{!selectedVersionDiff.changed && t('contentBrief.noChanges')}</p>
          {(selectedVersionDiff.addedLines.length > 0 || selectedVersionDiff.removedLines.length > 0) && <details className="mt-1"><summary className="cursor-pointer text-slate-500">{t('contentBrief.showChangedLines')}</summary><div className="mt-1 max-h-40 space-y-0.5 overflow-y-auto font-mono">{selectedVersionDiff.addedLines.map((line, index) => <div key={`added-${index}-${line}`} className="break-words text-emerald-300">+ {line || ' '}</div>)}{selectedVersionDiff.removedLines.map((line, index) => <div key={`removed-${index}-${line}`} className="break-words text-rose-300">- {line || ' '}</div>)}</div></details>}
        </div>}
      </section>
  );
};
