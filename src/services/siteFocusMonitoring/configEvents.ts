/** Fired after a project's Core Topic inputs (topic, anchors, goal, brand dictionary) are saved (#82). */
export const FOCUS_CONFIG_EVENT = 'seomi:focus-config-changed';

export const notifyFocusConfigChanged = (projectId: string): void => {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent(FOCUS_CONFIG_EVENT, { detail: { projectId } }));
};

/** Listens for saved Core Topic inputs of one project; returns the unsubscribe function. */
export const onFocusConfigChanged = (projectId: string | null | undefined, listener: () => void): (() => void) => {
  if (!projectId || typeof window === 'undefined' || typeof window.addEventListener !== 'function') return () => undefined;
  const handler = (event: Event): void => {
    const detail = (event as CustomEvent<{ projectId?: string }>).detail;
    if (detail?.projectId === projectId) listener();
  };
  window.addEventListener(FOCUS_CONFIG_EVENT, handler);
  return () => window.removeEventListener(FOCUS_CONFIG_EVENT, handler);
};
