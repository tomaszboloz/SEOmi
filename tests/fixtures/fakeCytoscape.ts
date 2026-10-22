import { vi } from 'vitest';

type Handler = (event: unknown) => void;

export interface FakeNode { id: () => string; addClass: (name: string) => void }

/** Minimal Cytoscape stand-in: jsdom has no canvas, so the map is tested through this recorder. */
export class FakeCy {
  handlers: Array<{ event: string; selector?: string; fn: Handler }> = [];
  elementsAdded: Array<{ data: { id: string } }> = [];
  classes = new Map<string, Set<string>>();
  selected: string[] = [];
  level = 1;
  destroyed = false;
  layoutCalls: unknown[] = [];
  fitCalls: unknown[][] = [];
  zoomCalls: unknown[] = [];
  options: unknown;

  constructor(options: unknown) { this.options = options; }

  on(event: string, selectorOrFn: string | Handler, fn?: Handler) {
    this.handlers.push(typeof selectorOrFn === 'string' ? { event, selector: selectorOrFn, fn: fn! } : { event, fn: selectorOrFn });
  }
  emit(event: string, payload: unknown, selector?: string) {
    this.handlers.filter((entry) => entry.event === event && (!entry.selector || entry.selector === selector)).forEach((entry) => entry.fn(payload));
  }
  batch(fn: () => void) { fn(); }
  elements() {
    return {
      remove: () => { this.elementsAdded = []; },
      removeClass: () => { this.classes.clear(); },
      unselect: () => { this.selected = []; },
    };
  }
  add(elements: Array<{ data: { id: string } }>) { this.elementsAdded = elements; }
  nodes() {
    return { forEach: (fn: (node: FakeNode) => void) => this.elementsAdded.forEach((element) => fn({ id: () => element.data.id, addClass: (name) => { this.classes.set(name, (this.classes.get(name) ?? new Set()).add(element.data.id)); } })) };
  }
  getElementById(id: string) { return { select: () => { this.selected.push(id); } }; }
  layout(options: unknown) { this.layoutCalls.push(options); return { run: vi.fn() }; }
  zoom(arg?: { level: number }) { if (arg === undefined) return this.level; this.level = arg.level; this.zoomCalls.push(arg); return this.level; }
  width() { return 800; }
  height() { return 600; }
  fit(...args: unknown[]) { this.fitCalls.push(args); }
  destroy() { this.destroyed = true; }
}

export const fakeInstances: FakeCy[] = [];
const cytoscape = Object.assign((options: unknown) => { const cy = new FakeCy(options); fakeInstances.push(cy); return cy; }, { use: vi.fn() });
export default cytoscape;
