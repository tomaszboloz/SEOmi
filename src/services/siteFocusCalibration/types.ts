import type { FallbackMode, FocusPage, SfsBand, SfsProfileRef, SiteFocusOptions, TrsGroup } from '@/services/siteFocus';

/** Corpus kinds #52 asks for (GEM-52-01); a report says which are still missing. */
export const CALIBRATION_KINDS = ['niche', 'offer-blog', 'ecommerce', 'multi-topic', 'polysemy'] as const;
export type CalibrationKind = (typeof CALIBRATION_KINDS)[number] | 'other';
/** Human judgement of a page; `on-topic` corresponds to the `strong` TRS group. */
export type ManualLabel = 'on-topic' | 'borderline' | 'off-topic';

/** Where a crawl came from. Without explicit consent the site is rejected, never scored. */
export interface CalibrationProvenance {
  source: string;
  consent: boolean;
  crawledAt: string;
  notes?: string;
}

export interface CalibrationSite {
  id: string;
  kind: CalibrationKind;
  startUrl: string;
  pages: FocusPage[];
  provenance: CalibrationProvenance;
  /** Optional manual on-topic/borderline/off-topic labels per URL (GEM-52-07). */
  labels?: Record<string, ManualLabel>;
  /** SHA-256 of the persisted input file, filled by the runner for reproducibility (GEM-52-09). */
  inputSha256?: string;
  options?: Pick<SiteFocusOptions, 'manualTopic' | 'anchorUrls' | 'businessGoal' | 'brand' | 'language'>;
}

export interface ScaleOutcome { scale: number; sfs: number | null; band: SfsBand | null; groups: Record<TrsGroup, number> }
export interface LabelMatrix {
  labelled: number;
  /** rows: manual label, columns: predicted TRS group. */
  matrix: Record<ManualLabel, Record<TrsGroup, number>>;
  agreementPct: number | null;
  /** Labelled on-topic but scored off-topic (would get removal advice by mistake). */
  falseOffTopic: string[];
  /** Labelled off-topic but scored strong. */
  missedOffTopic: string[];
  unmatchedLabels: string[];
}

export interface SiteCalibration {
  id: string;
  kind: CalibrationKind;
  inputSha256: string | null;
  pageCount: number;
  scored: number;
  skipped: number;
  /** Pages scored from fallback data (no focus terms): partial evidence. */
  partial: number;
  unavailable: boolean;
  sfs: number | null;
  band: SfsBand | null;
  confidence: number | null;
  onTopicRatio: number | null;
  fallbackMode: FallbackMode;
  coreTopic: { label: string; mode: string };
  /** Content pages per 10-point TRS bucket, 0-9 ... 90-100. */
  trsHistogram: number[];
  scales: ScaleOutcome[];
  labels: LabelMatrix | null;
}

export interface CalibrationReport {
  profile: SfsProfileRef;
  generatedAt: string;
  scales: number[];
  sites: SiteCalibration[];
  rejected: Array<{ id: string; reason: 'no-consent' | 'no-pages' | 'no-source' }>;
  missingKinds: string[];
  /** True only with at least 3 consented, scored sites; otherwise the report must not change thresholds. */
  sufficient: boolean;
}
