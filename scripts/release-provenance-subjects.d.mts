export interface ReleaseProvenanceSubject {
  name: string;
  role: string;
}

/**
 * Resolve the release assets used as provenance subjects.
 *
 * The implementation validates the inventory at runtime because GitHub's
 * release payload is external data. `unknown` keeps callers from assuming a
 * shape before that validation has completed.
 */
export declare function resolveProvenanceArtifacts(
  assets: unknown,
  version: string,
): ReleaseProvenanceSubject[];
