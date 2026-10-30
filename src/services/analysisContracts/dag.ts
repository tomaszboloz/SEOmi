import { availability, envelope, type ReportEnvelope } from './envelope';

/**
 * Formal analysis DAG (#85 GEM-85-06, T05): modules declare their inputs, run once in dependency order
 * and receive upstream envelopes. A failed or cancelled node never yields a fabricated value downstream:
 * dependents become `unavailable/upstream:<id>` unless they opt in to partial inputs. Results are frozen,
 * so a stored baseline cannot be mutated by a later rerun.
 */
export interface DagNode {
  id: string;
  deps: string[];
  /** Run even when some inputs are not available (the node must then report partial itself). */
  acceptsPartial?: boolean;
  run: (inputs: Readonly<Record<string, ReportEnvelope<unknown>>>, signal: AbortSignal) => Promise<ReportEnvelope<unknown>>;
}

export interface DagContext { projectId: string; runId: string | null; generatedAt: string; signal?: AbortSignal; retries?: number }

export type DagResult = Readonly<Record<string, ReportEnvelope<unknown>>>;

export class DagCycleError extends Error {
  constructor(public readonly nodes: string[]) {
    super(`Analysis DAG has a cycle or unknown dependency: ${nodes.join(', ')}`);
    this.name = 'DagCycleError';
  }
}

/** Kahn topological order; throws on cycles or dependencies that are not declared nodes. */
export const topologicalOrder = (nodes: DagNode[]): string[] => {
  const ids = new Set(nodes.map((node) => node.id));
  const unknown = nodes.filter((node) => node.deps.some((dep) => !ids.has(dep))).map((node) => node.id);
  if (unknown.length) throw new DagCycleError(unknown);
  const indegree = new Map(nodes.map((node) => [node.id, node.deps.length]));
  const order: string[] = [];
  const ready = nodes.filter((node) => !node.deps.length).map((node) => node.id).sort();
  while (ready.length) {
    const id = ready.shift() as string;
    order.push(id);
    nodes.filter((node) => node.deps.includes(id)).forEach((node) => {
      const left = (indegree.get(node.id) ?? 0) - 1;
      indegree.set(node.id, left);
      if (left === 0) ready.push(node.id);
    });
    ready.sort();
  }
  if (order.length !== nodes.length) throw new DagCycleError(nodes.filter((node) => !order.includes(node.id)).map((node) => node.id));
  return order;
};

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value) && !ArrayBuffer.isView(value)) {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

const marker = (ctx: DagContext, id: string, status: 'unavailable' | 'cancelled' | 'error', reason: string): ReportEnvelope<unknown> =>
  envelope({ projectId: ctx.projectId, runId: ctx.runId, module: id, algorithmVersion: 0, generatedAt: ctx.generatedAt, value: null, availability: availability(status, reason, 0) });

const USABLE = new Set(['complete', 'partial', 'stale']);

const attempt = async (node: DagNode, inputs: Record<string, ReportEnvelope<unknown>>, ctx: DagContext, signal: AbortSignal): Promise<ReportEnvelope<unknown>> => {
  const tries = Math.max(1, Math.floor(ctx.retries ?? 0) + 1);
  let last = 'unknown';
  for (let index = 0; index < tries; index += 1) {
    if (signal.aborted) return marker(ctx, node.id, 'cancelled', 'cancelled');
    try {
      const result = await node.run(Object.freeze({ ...inputs }), signal);
      if (result.projectId !== ctx.projectId) return marker(ctx, node.id, 'error', 'mixed-projects');
      return result;
    } catch (error) {
      if (signal.aborted) return marker(ctx, node.id, 'cancelled', 'cancelled');
      last = error instanceof Error ? error.message : String(error);
    }
  }
  return marker(ctx, node.id, 'error', `failed:${last}`);
};

/** Runs every node once; one module failing does not abort its independent siblings. */
export const runDag = async (nodes: DagNode[], ctx: DagContext): Promise<DagResult> => {
  const order = topologicalOrder(nodes);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const signal = ctx.signal ?? new AbortController().signal;
  const results: Record<string, ReportEnvelope<unknown>> = {};
  for (const id of order) {
    const node = byId.get(id) as DagNode;
    const inputs = Object.fromEntries(node.deps.map((dep) => [dep, results[dep]]));
    const blocked = node.deps.find((dep) => !USABLE.has(results[dep].availability.status));
    if (signal.aborted) results[id] = marker(ctx, id, 'cancelled', 'cancelled');
    else if (blocked && !node.acceptsPartial) results[id] = marker(ctx, id, 'unavailable', `upstream:${blocked}`);
    else results[id] = await attempt(node, inputs, ctx, signal);
    deepFreeze(results[id]);
  }
  return Object.freeze(results);
};
