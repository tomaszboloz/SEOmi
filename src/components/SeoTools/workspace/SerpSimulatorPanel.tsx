import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Search } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { readStorage, writeStorage } from '@/services/storage';
import { simulatorStorageKey } from './seoToolsTypes';

interface SimulatorState {
  url: string;
  title: string;
  description: string;
}

export const SerpSimulatorPanel: React.FC = () => {
  const { t } = useTranslation();
  const projectId = useProjectStore((state) => state.activeProjectId);
  const project = useProjectStore((state) =>
    state.projects.find((item) => item.id === state.activeProjectId),
  );
  const [form, setForm] = useState<SimulatorState>({
    url: project?.rootUrl || '',
    title: '',
    description: '',
  });

  useEffect(() => {
    if (!projectId) return;
    try {
      const saved = JSON.parse(
        readStorage(simulatorStorageKey(projectId)) || 'null',
      ) as Partial<SimulatorState> | null;
      setForm({
        url: saved?.url || project?.rootUrl || '',
        title: saved?.title || '',
        description: saved?.description || '',
      });
    } catch {
      setForm({ url: project?.rootUrl || '', title: '', description: '' });
    }
  }, [projectId, project?.rootUrl]);

  const update = (patch: Partial<SimulatorState>) => {
    const next = { ...form, ...patch };
    setForm(next);
    if (projectId)
      writeStorage(simulatorStorageKey(projectId), JSON.stringify(next));
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
      <div className="space-y-3">
        <label className="block text-xs text-slate-400">
          {t('seoTools.serpUrl')}
          <input
            value={form.url}
            onChange={(event) => update({ url: event.target.value })}
            className="mt-1.5 h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-white"
          />
        </label>
        <label className="block text-xs text-slate-400">
          {t('seoTools.serpTitle')}
          <input
            value={form.title}
            onChange={(event) => update({ title: event.target.value })}
            className="mt-1.5 h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-white"
          />
        </label>
        <label className="block text-xs text-slate-400">
          {t('seoTools.serpDescription')}
          <textarea
            value={form.description}
            onChange={(event) => update({ description: event.target.value })}
            rows={5}
            className="mt-1.5 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
          />
        </label>
      </div>
      <div className="rounded-xl border border-slate-800 bg-white p-5 text-slate-900 shadow-lg">
        <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Search className="h-4 w-4" aria-hidden="true" />
          {t('seoTools.serpPreview')}
        </div>
        <p className="truncate text-sm text-emerald-700">
          {form.url || t('seoTools.notAvailable')}
        </p>
        <h3 className="mt-1 line-clamp-2 text-xl text-blue-700">
          {form.title || t('seoTools.serpTitle')}
        </h3>
        <p className="mt-2 line-clamp-3 text-sm leading-5 text-slate-600">
          {form.description || t('seoTools.serpDescription')}
        </p>
        <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-500">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          {t('seoTools.characterCount', { count: form.title.length })} ·{' '}
          {t('seoTools.characterCount', { count: form.description.length })}
        </div>
      </div>
    </div>
  );
};
