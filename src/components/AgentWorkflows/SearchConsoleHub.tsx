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
  return <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
    <SearchConsoleHeader session={session} />
    {!session.isGscConnected ? <SearchConsoleConnection session={session} /> :
      <div className="space-y-8">
        <SearchConsoleControls session={session} />
        <SearchConsoleMetrics session={session} />
        <SearchConsoleComparison session={session} />
        {session.currentSnapshot && <GscOpportunities snapshot={session.currentSnapshot} />}
        {session.currentSnapshot && <GscCannibalization key={session.currentSnapshot.id} snapshot={session.currentSnapshot} />}
        <SearchConsoleInspection session={session} />
        <SearchConsoleTables session={session} />
      </div>}
  </div>;
}
