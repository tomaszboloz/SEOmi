import type { DiagnosisVerdict } from '../types';
import { sortVerdicts, type VerdictContext } from './context';
import { documentVerdicts } from './documents';
import { duplicateVerdicts } from './duplicates';
import { hubVerdicts } from './hubs';
import { topicVerdicts } from './topics';

export type { VerdictContext } from './context';

/** Verdicts ordered fix, weak, info, good, then by code and scope. */
export const buildVerdicts = (context: VerdictContext): DiagnosisVerdict[] =>
  sortVerdicts([...(context.contentLinks ? hubVerdicts(context) : []), ...topicVerdicts(context), ...documentVerdicts(context), ...duplicateVerdicts(context)]);
