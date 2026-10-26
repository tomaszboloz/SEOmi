export type ModelAnalysis = 'ocr' | 'clip-alignment' | 'transcript';

export interface AnalysisState {
  analysis: ModelAnalysis;
  /** Always 'unavailable' today: no local OCR, CLIP or speech model is wired into the app. */
  status: 'unavailable';
  reason: 'no-local-model';
  /** Missing model never lowers the technical alt/size audit. */
  affectsTechnicalAudit: false;
}

/**
 * Honest placeholder for analyses that need a local model (issue #96). It exists so the UI and reports can
 * show "unavailable" instead of a fabricated result. Replace with a real runner only when a local model path exists.
 */
export const modelAnalysisState = (analysis: ModelAnalysis): AnalysisState => ({ analysis, status: 'unavailable', reason: 'no-local-model', affectsTechnicalAudit: false });

export const allModelAnalysisStates = (): AnalysisState[] => (['ocr', 'clip-alignment', 'transcript'] as const).map(modelAnalysisState);
