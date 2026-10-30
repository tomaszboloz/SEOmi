import { useEffect, useState } from 'react';
import { onFocusConfigChanged } from '@/services/siteFocusMonitoring/configEvents';
import { focusConfigRevision } from '@/services/siteFocusMonitoring/focusOptions';

/**
 * Hash of the project's saved Core Topic inputs that changes as soon as the topic, anchors, goal or
 * brand dictionary is saved anywhere in the app. Views that build TAS/IGOS/EETV from the Site Focus
 * report add it to their memo keys, so a goal change invalidates them instead of showing a stale Core (#82).
 */
export const useFocusConfigRevision = (projectId: string | null | undefined): string => {
  const [revision, setRevision] = useState(() => focusConfigRevision(projectId));
  const [scope, setScope] = useState(projectId);
  if (scope !== projectId) {
    setScope(projectId);
    setRevision(focusConfigRevision(projectId));
  }
  useEffect(() => onFocusConfigChanged(projectId, () => setRevision(focusConfigRevision(projectId))), [projectId]);
  return revision;
};
