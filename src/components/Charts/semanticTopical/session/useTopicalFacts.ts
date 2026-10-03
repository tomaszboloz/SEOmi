import { useState, type MutableRefObject } from 'react';
import type { TopicalMapDocument, TopicalNode } from '@/services/topicalMap';
import { createId } from '@/services/ids';

interface Props {
  documentRef: MutableRefObject<TopicalMapDocument>;
  selectedNode: TopicalNode | null;
  updateEntity: (update: Partial<TopicalMapDocument['entity']>) => void;
  updateNode: (nodeId: string, update: Partial<TopicalNode>) => void;
}

export const useTopicalFacts = ({
  documentRef,
  selectedNode,
  updateEntity,
  updateNode,
}: Props) => {
  const [factDraft, setFactDraft] = useState({
    attribute: '',
    value: '',
    sourceUrl: '',
  });

  const [topicFactDraft, setTopicFactDraft] = useState({
    attribute: '',
    value: '',
    sourceUrl: '',
  });

  const addEntityFact = () => {
    const attribute = factDraft.attribute.trim();
    const value = factDraft.value.trim();
    if (!attribute || !value) return;
    updateEntity({
      facts: [
        ...documentRef.current.entity.facts,
        {
          id: createId('fact'),
          attribute: attribute.slice(0, 120),
          value: value.slice(0, 1000),
          sourceUrl: factDraft.sourceUrl.trim().slice(0, 2048),
          reuseStatus: 'locked',
        },
      ],
    });
    setFactDraft({ attribute: '', value: '', sourceUrl: '' });
  };

  const addTopicFact = () => {
    if (!selectedNode) return;
    const attribute = topicFactDraft.attribute.trim();
    const value = topicFactDraft.value.trim();
    if (!attribute || !value) return;
    updateNode(selectedNode.id, {
      facts: [
        ...selectedNode.facts,
        {
          id: createId('fact'),
          attribute: attribute.slice(0, 120),
          value: value.slice(0, 1000),
          sourceUrl: topicFactDraft.sourceUrl.trim().slice(0, 2048),
          reuseStatus: 'locked',
        },
      ],
    });
    setTopicFactDraft({ attribute: '', value: '', sourceUrl: '' });
  };

  return {
    factDraft,
    setFactDraft,
    topicFactDraft,
    setTopicFactDraft,
    addEntityFact,
    addTopicFact,
  };
};
