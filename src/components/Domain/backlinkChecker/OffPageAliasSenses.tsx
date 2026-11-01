import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatAliasSenses, loadAliasSenses, parseAliasSenses, saveAliasSenses } from '@/services/offPage/aliasSenseStore';

/** Editor for alias/homonym rules (#93). Rules are the user's evidence; saved per project, used on next analysis. */
export const OffPageAliasSenses = ({ projectId, disabled }: { projectId: string | null; disabled: boolean }) => {
  const { t } = useTranslation();
  const [text, setText] = useState(() => formatAliasSenses(loadAliasSenses(projectId)));
  const [saved, setSaved] = useState(true);
  return <div className="space-y-1">
    <label>{t('offPageSourcesUi.senses.label')}
      <textarea rows={3} value={text} disabled={disabled || !projectId} aria-describedby="offpage-senses-hint"
        onChange={(event) => { setText(event.target.value); setSaved(true); }}
        onBlur={() => setSaved(saveAliasSenses(projectId, parseAliasSenses(text)))} />
    </label>
    <p id="offpage-senses-hint">{t('offPageSourcesUi.senses.hint')}</p>
    {!saved && <p role="alert">{t('offPageSourcesUi.senses.error')}</p>}
  </div>;
};
