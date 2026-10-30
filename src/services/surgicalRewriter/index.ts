export { firstSentenceOf, semanticSections, type SemanticSection } from './sections';
export { buildSurgicalPagePrescription, type SectionSignal, type SurgicalPrescription } from './prescription';

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);

export interface SurgicalAfter { level: number; heading: string; answerFirst: string; original: string }

/**
 * "After" HTML for copy (#127): new heading, the localized Answer-First scaffold and the original first
 * paragraph below it. All text is escaped; the scaffold keeps its [placeholders] for the editor to fill
 * with verified facts (YMYL fact gate #137), nothing is published.
 */
export const surgicalAfterHtml = ({ level, heading, answerFirst, original }: SurgicalAfter): string => {
  const tag = level === 3 ? 'h3' : 'h2';
  return [`<${tag}>${escapeHtml(heading)}</${tag}>`, `<p>${escapeHtml(answerFirst)}</p>`, ...(original ? [`<p>${escapeHtml(original)}</p>`] : [])].join('\n');
};
