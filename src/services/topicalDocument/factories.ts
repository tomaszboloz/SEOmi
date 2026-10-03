import i18n from '@/i18n';
import type { TopicalMapDocument, TopicalContentBrief, TopicalNode } from './types';
import { id, cleanText } from './primitives';
export const createEmptyTopicalMap = (): TopicalMapDocument => ({
  schemaVersion: 1,
  entity: { name: '', description: '', facts: [] },
  nodes: [],
  updatedAt: new Date().toISOString(),
});

export const createEmptyContentBrief = (): TopicalContentBrief => ({
  targetQueryId: '', requiredEntities: [], snippetTarget: 'none', internalLinkTargets: [], draftMarkdown: '', paragraphReviews: [], draftVersions: [],
});

export const createTopicalNode = (title = i18n.t('runtimeErrors.topical.newTopic')): TopicalNode => ({
  id: id(), title: cleanText(title, 180) || i18n.t('runtimeErrors.topical.newTopic'), kind: 'cluster', boundary: 'core', parentId: null, relatedNodeIds: [],
  intent: 'unknown', lifecycle: 'planned', scheduledDate: '', queries: [], facts: [], evidenceTerms: [],
  sourceUrls: [], sourceRunId: null, sourceClusterId: null, contentBrief: createEmptyContentBrief(),
});
