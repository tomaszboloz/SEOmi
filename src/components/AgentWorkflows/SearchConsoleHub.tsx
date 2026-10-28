import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import { Ga4Panel } from './searchConsole/ga4/Ga4Panel';
import { GscOpportunities } from './GscOpportunities';
import { GscCannibalization } from './GscCannibalization';
import { useSearchConsoleSession } from './searchConsole/useSearchConsoleSession';
import { SearchConsoleHeader } from './searchConsole/Header';
import { SearchConsoleConnection } from './searchConsole/Connection';
import { SearchConsoleControls } from './searchConsole/Controls';
import { SearchConsoleMetrics } from './searchConsole/Metrics';
import { SearchConsoleComparison } from './searchConsole/Comparison';
import { SearchConsoleInspection } from './searchConsole/Inspection';
import { SearchConsoleTables } from './searchConsole/Tables';

export function SearchConsoleHub() {
  const session = useSearchConsoleSession();
  const projectRootUrl = useProjectStore((s) => s.projects.find((project) => project.id === session.activeProjectId)?.rootUrl);
  const crawlResult = useToolsStore((s) => s.crawlResult);
  return <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
    <SearchConsoleHeader session={session} />
    {!session.isGscScopeReady ? null : !session.isGscConnected ? <SearchConsoleConnection session={session} /> :
      <div className="space-y-8">
        <SearchConsoleControls session={session} />
        <SearchConsoleMetrics session={session} />
        <SearchConsoleComparison session={session} />
        {session.currentSnapshot && <GscOpportunities key={`${session.activeProjectId}|${session.currentSnapshot.id}`} snapshot={session.currentSnapshot} data={session.gscData ?? undefined} projectId={session.activeProjectId} />}
        {session.currentSnapshot && session.gscData && <GscCannibalization key={session.currentSnapshot.id} data={session.gscData} />}
        <SearchConsoleInspection session={session} />
        <SearchConsoleTables session={session} />
        <Ga4Panel session={session} projectRootUrl={projectRootUrl} crawlResult={crawlResult} />
      </div>}
  </div>;
}
