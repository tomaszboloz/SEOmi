import { useTranslation } from 'react-i18next';
import type { BacklinkProfileData } from '@/types';
import { OffPagePanel } from '@/components/Charts/OffPagePanel';
import { useOffPageReports } from './useOffPageReports';
import { useOffPageSources } from './useOffPageSources';
import { OffPageSourceResults } from './OffPageSourceResults';
import { OffPageAliasSenses } from './OffPageAliasSenses';
import { OffPageHistory } from './OffPageHistory';
import { OffPageAnchorContexts, OffPageLinkProfile } from './OffPageLinkEvidence';

export const OffPageSourcesWorkspace = ({ profile }: { profile: BacklinkProfileData }) => {
  const { t } = useTranslation();
  const session = useOffPageSources(profile);
  const reports = useOffPageReports(profile, session.analysis);
  const running = session.status === 'running';
  return <div className="space-y-3" data-testid="offpage-sources">
    <OffPagePanel {...reports} />
    <OffPageLinkProfile profile={profile} />
    <p>{t('offPageSourcesUi.scope')}</p>
    <p>{t('offPageSourcesUi.pacing')}</p>
    <label>{t('offPageSourcesUi.provider')}
      <select disabled={running} value={session.settings.provider} onChange={(event) => session.setSettings({ ...session.settings, provider: event.target.value })}>
        <option value="local">{t('offPageSourcesUi.local')}</option>
        <option value="ollama">{t('offPageSourcesUi.ollama')}</option>
      </select>
    </label>
    {session.settings.provider === 'ollama' && <label>{t('offPageSourcesUi.model')}
      <input value={session.settings.ollamaModel ?? ''} disabled={running}
        onChange={(event) => session.setSettings({ ...session.settings, ollamaModel: event.target.value })} />
    </label>}
    <OffPageAliasSenses key={session.projectId ?? ''} projectId={session.projectId} disabled={running} />
    <button type="button" disabled={!session.enabled || running} onClick={() => void session.run()}>{t('offPageSourcesUi.analyze')}</button>
    {running && <button type="button" onClick={session.cancel}>{t('offPageSourcesUi.cancel')}</button>}
    {session.status !== 'idle' && <>
      <p role="status">{t(`offPageSourcesUi.status.${session.status}`)}</p>
      <OffPageSourceResults sources={session.sources} reports={reports} />
      <OffPageAnchorContexts profile={profile} sources={session.sources} />
    </>}
    <OffPageHistory key={session.projectId ?? ''} projectId={session.projectId} current={session.record} saved={session.historySaved} />
  </div>;
};
