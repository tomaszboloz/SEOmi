import type { ToolsGet } from '../contracts';
import { activeProjectId } from '../storageKeys';

export const isCurrentExternalLinkCheck = (projectId: string, requestId: string, get: ToolsGet): boolean =>
  activeProjectId() === projectId && get().crawlExternalLinkCheckProgress?.requestId === requestId;

export const boundedExternalLinkLimit = (value: number): number =>
  Number.isFinite(value) ? Math.min(Math.max(Math.floor(value), 1), 1_000) : 1;
