export interface ArtifactSubject {
  name: string;
  sha256: string;
  size: number;
  role: string;
}

export interface SbomEntry {
  name: string;
  sha256: string;
  format: string;
  target: string;
}

export interface ProvenanceInventory {
  schemaVersion: string;
  repository: string;
  tag: string;
  commitSha: string;
  version: string;
  createdAt: string;
  subjects: ArtifactSubject[];
  sboms: SbomEntry[];
}

export interface GenerateChecksumsOptions {
  artifactDir?: string;
  files: string[];
  outputPath?: string;
}

export interface BuildInventoryOptions {
  repository: string;
  tag: string;
  commitSha: string;
  version: string;
  artifacts: ArtifactSubject[];
  sboms?: SbomEntry[];
}

export interface ValidateProvenanceContractOptions {
  inventory: ProvenanceInventory;
  checksumsContent: string;
  sbomNode: Record<string, unknown>;
  sbomRust: Record<string, unknown>;
  expectedSha: string;
  expectedVersion: string;
  artifactDir?: string;
}

export interface PrepareProvenanceOptions {
  apiUrl?: string;
  uploadUrl?: string;
  repository?: string;
  releaseId?: number | string;
  commitSha?: string;
  tag?: string;
  token?: string;
  artifactDir?: string;
  fetchImpl?: typeof fetch;
}

export declare function computeFileSha256(filePath: string): string;

export declare function generateArtifactChecksums(options: GenerateChecksumsOptions): string;

export declare function buildProvenanceInventory(options: BuildInventoryOptions): ProvenanceInventory;

export declare function validateProvenanceContract(options: ValidateProvenanceContractOptions): boolean;

export declare function prepareReleaseProvenance(options: PrepareProvenanceOptions): Promise<{ checksums: string; inventory: ProvenanceInventory }>;
