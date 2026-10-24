import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { interventionKinds, type NewIntervention } from '@/services/experiments/registry';

export const InterventionForm = ({ urls, onAdd }: { urls: string[]; onAdd: (input: NewIntervention) => boolean }) => {
  const { t } = useTranslation();
  const [url, setUrl] = useState('site');
  const [date, setDate] = useState('');
  const [kind, setKind] = useState<NewIntervention['kind']>('content');
  const [note, setNote] = useState('');
  const [failed, setFailed] = useState(false);
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const saved = onAdd({ url, date, kind, note });
    setFailed(!saved);
    if (saved) setNote('');
  };
  const fieldClass = 'rounded border border-slate-600 bg-slate-900 p-2 text-slate-100';
  return <form onSubmit={submit} className="grid gap-2 md:grid-cols-2" aria-label={t('experimentsUi.add')}>
    <label className="grid gap-1">{t('experimentsUi.url')}
      <select value={url} onChange={event => setUrl(event.target.value)} className={fieldClass}>
        <option value="site">{t('experimentsUi.site')}</option>
        {urls.map(value => <option key={value} value={value}>{value}</option>)}
      </select>
    </label>
    <label className="grid gap-1">{t('experimentsUi.date')}
      <input type="date" required value={date} onChange={event => setDate(event.target.value)} className={fieldClass} />
    </label>
    <label className="grid gap-1">{t('experimentsUi.kind')}
      <select value={kind} onChange={event => setKind(event.target.value as NewIntervention['kind'])} className={fieldClass}>
        {interventionKinds.map(value => <option key={value} value={value}>{t(`experimentsUi.kinds.${value}`)}</option>)}
      </select>
    </label>
    <label className="grid gap-1">{t('experimentsUi.note')}
      <textarea maxLength={300} value={note} onChange={event => setNote(event.target.value)} className={fieldClass} />
    </label>
    <button type="submit" className="rounded bg-sky-700 p-2 text-white">{t('experimentsUi.add')}</button>
    {failed && <p role="alert">{t('experimentsUi.saveFailed')}</p>}
  </form>;
};
