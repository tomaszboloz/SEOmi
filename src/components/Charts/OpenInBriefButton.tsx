import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import { applyRecommendationToBrief } from '@/services/executionCard/briefInjection';
import type { BriefRecommendationInput } from '@/services/executionCard/briefInput';
import { readTopicalMap, writeTopicalMap } from '@/services/topicalDocument/storage';

interface Props {
  projectId: string;
  input: BriefRecommendationInput;
  /** Called with the brief node id so the host can open the brief workstation. */
  onOpened?: (nodeId: string) => void;
}

type State = 'idle' | 'created' | 'updated' | 'failed';

/** 1-click: creates or updates the content brief from the recommendation's own data. */
export const OpenInBriefButton = ({ projectId, input, onOpened }: Props) => {
  const { t } = useTranslation();
  const [state, setState] = useState<State>('idle');
  const open = () => {
    try {
      const result = applyRecommendationToBrief(readTopicalMap(projectId), input);
      if (!result.nodeId) return setState('failed');
      writeTopicalMap(projectId, result.document);
      setState(result.created ? 'created' : 'updated');
      onOpened?.(result.nodeId);
    } catch {
      setState('failed');
    }
  };
  return <span className="inline-flex items-center gap-1">
    <button type="button" onClick={open} className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-sky-100 hover:bg-sky-500/20">{t('executionCard.brief.open')}</button>
    <HelpTip id="executionCard.brief" />
    {state !== 'idle' && <span role="status" className="text-[10px] text-slate-400">{t(`executionCard.brief.state.${state}`)}</span>}
  </span>;
};
