import { sha256Hex } from '@/services/team/auditLog';
import { ADAPTERS } from './adapters';
import { diffLines, type DiffLine } from './diff';
import { patchSection } from './patch';
import { assertSafeCmsUrl } from './ssrf';
import type { CmsTarget, CmsTransport } from './types';

export interface PatchRequest {
  target: CmsTarget;
  /** Heading text of the one section to rewrite. */
  heading: string;
  replacement: string;
  /** Health/finance/legal content: writing needs a passed fact gate. */
  ymyl: boolean;
}

export interface PatchPlan extends PatchRequest {
  baseRevision: string;
  before: string;
  after: string;
  sectionBefore: string;
  diff: DiffLine[];
  /** Binds a human approval to this exact revision and result; any change invalidates it. */
  planHash: string;
}

/** Dry run: reads the page and builds the diff. Never writes. */
export const planPatch = async (request: PatchRequest, send: CmsTransport): Promise<PatchPlan> => {
  assertSafeCmsUrl(request.target.baseUrl);
  const doc = await ADAPTERS[request.target.kind].read(request.target, send);
  const patched = patchSection(doc.content, request.heading, request.replacement);
  const planHash = await sha256Hex(JSON.stringify([request.target.kind, request.target.baseUrl, request.target.contentId, doc.revision, patched.content]));
  return { ...request, baseRevision: doc.revision, before: doc.content, after: patched.content, sectionBefore: patched.before, diff: diffLines(doc.content, patched.content), planHash };
};
