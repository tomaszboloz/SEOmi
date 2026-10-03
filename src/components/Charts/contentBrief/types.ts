import type { TopicalEntityFact, TopicalNode } from '@/services/topicalMap';
import type { CrawledPageSummary } from '@/types';

export interface BriefEditorProps {
  node: TopicalNode;
  facts: TopicalEntityFact[];
  pages: CrawledPageSummary[];
  onUpdate: (brief: TopicalNode['contentBrief']) => void;
  onAdvance: () => void;
}
