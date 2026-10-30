import type { SimilaritySource } from '@/services/semanticSource/types';
import type { AuthorityRecommendation, DepthInputs, AuthorityWarning, CannibalGroup, FreshnessReport, PillarCoverage, Pillars, Quadrant, SiloReport, SubtopicCoverage } from './metrics';
import type { ReferenceTaxonomy } from './taxonomy';

export const TAS_VERSION = 1;

export interface TopicalAuthorityReport {
  /** Final TAS (rounded); null while no reference taxonomy exists. */
  tas: number | null;
  tasRaw: number | null;
  /** Focus multiplier mu_SFS = 0.7 + 0.3 * SFS / 100. */
  multiplier: number;
  sfs: number;
  quadrant: Quadrant | null;
  pillars: Pillars;
  /** Pillar names left out of TAS_raw because they could not be measured. */
  unavailable: Array<keyof Pillars>;
  cannibalizationIndex: number;
  coverage: SubtopicCoverage[];
  pillarCoverage: PillarCoverage[];
  silo: SiloReport;
  cannibalization: CannibalGroup[];
  freshness: FreshnessReport;
  recommendations: AuthorityRecommendation[];
  warnings: AuthorityWarning[];
  /** Pages mapped to the same template as a representative (programmatic SEO). */
  templateDuplicates: string[];
  taxonomy: ReferenceTaxonomy | null;
  pageCount: number;
  generatedAt: string;
  version: number;
  /** Inputs behind CDES; `partial` when PAA/questions, entities or InfoGain were missing for some pages (#58). */
  depthInputs?: DepthInputs;
  /** Which page-pair similarity produced cannibalization (#86); absent on reports built before it existed. */
  similaritySource?: SimilaritySource;
}
