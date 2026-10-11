import type { DiagnosisVerdict } from '@/services/topicalDiagnosis';

export type Translate = (key: string, values?: Record<string, unknown>) => string;

export interface VerdictCopy {
  title: string;
  action: string;
  evidence: string[];
  severity: string;
  scope: string;
  confidence: string;
}

/** Turns a verdict's keys and measured parameters into localized text; the service itself stays i18n-free. */
export const verdictText = (t: Translate, verdict: DiagnosisVerdict): VerdictCopy => {
  const params = Object.assign({}, ...verdict.evidence.map((entry) => entry.params ?? {})) as Record<string, unknown>;
  const base = `topicalDiagnosis.verdict.${verdict.code}`;
  const hasNearest = verdict.evidence.some((entry) => entry.key === 'nearest');
  const actionKey = verdict.code === 'document-isolated' && !hasNearest ? `${base}.actionNoNearest` : `${base}.action`;
  return {
    title: t(`${base}.title`, params),
    action: t(actionKey, params),
    evidence: verdict.evidence.map((entry) => t(`topicalDiagnosis.evidence.${entry.key}`, entry.params)),
    severity: t(`topicalDiagnosis.severity.${verdict.severity}`),
    scope: t(`topicalDiagnosis.scope.${verdict.scope}`),
    confidence: t(`topicalDiagnosis.confidence.${verdict.confidence}`),
  };
};

export const SEVERITY_CLASSES: Record<DiagnosisVerdict['severity'], string> = {
  fix: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
  weak: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
  good: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
};

export const shortPath = (url: string): string => {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}` || '/';
  } catch {
    return url;
  }
};
