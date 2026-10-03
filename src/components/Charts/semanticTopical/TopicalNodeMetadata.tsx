import type { Session } from './editor/types';
import { NodeIdentityFields } from './editor/NodeIdentityFields';
import { NodeLifecycleFields } from './editor/NodeLifecycleFields';

export const TopicalNodeMetadata = ({ session }: { session: Session }) => {
  if (!session.selectedNode) return null;
  return (<div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
    <NodeIdentityFields session={session} />
    <NodeLifecycleFields session={session} />
  </div>);
};
