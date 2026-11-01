/** Axe-style structural rules for jsdom (no axe dependency): returns violation strings, empty = pass. */
const nameOf = (el: Element, root: Element): string => {
  const labelled = el.getAttribute('aria-labelledby');
  if (labelled) return labelled.split(/\s+/).map((id) => root.ownerDocument.getElementById(id)?.textContent ?? '').join(' ').trim();
  const aria = el.getAttribute('aria-label');
  if (aria?.trim()) return aria.trim();
  const id = el.getAttribute('id');
  const label = id ? root.querySelector(`label[for="${id}"]`) : el.closest('label');
  return (label?.textContent ?? el.textContent ?? '').trim();
};

export const a11yViolations = (root: Element): string[] => {
  const out: string[] = [];
  root.querySelectorAll('button, input:not([type=hidden]), textarea, select, a[href]').forEach((el) => {
    if (!nameOf(el, root)) out.push(`no accessible name: ${el.tagName.toLowerCase()}`);
  });
  root.querySelectorAll('img').forEach((img) => { if (!img.hasAttribute('alt')) out.push('img without alt'); });
  const ids = [...root.querySelectorAll('[id]')].map((el) => el.id);
  ids.filter((id, i) => ids.indexOf(id) !== i).forEach((id) => out.push(`duplicate id: ${id}`));
  root.querySelectorAll('[aria-labelledby]').forEach((el) => {
    const missing = (el.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter((id) => !root.ownerDocument.getElementById(id));
    if (missing.length) out.push(`aria-labelledby target missing: ${missing.join(',')}`);
  });
  root.querySelectorAll('[role=list], ul, ol').forEach((list) => {
    if (list.querySelector(':scope > :not(li)')) out.push('list with non-li child');
  });
  return out;
};
