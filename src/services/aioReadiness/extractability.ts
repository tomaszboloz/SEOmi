import type { RagSection } from '@/types';

export interface ExtractabilityDetails { score: number; tables: number; orderedLists: number; conciseLists: number; outline: number; normalization: string[]; }

const bounded = (value: number): number => Math.max(0, Math.min(1, value));

export const extractabilityDetails = (sections: RagSection[]): ExtractabilityDetails => {
  const tableTotal = sections.reduce((sum, section) => sum + section.tables, 0);
  const tables = sections.reduce((sum, section) => sum + (section.tables > 0 && section.table_headers !== undefined && section.table_headers > 0 ? 1 : 0), 0);
  const orderedLists = sections.reduce((sum, section) => sum + (section.ordered_lists > 0 && section.ordered_list_instruction === true ? 1 : 0), 0);
  const conciseLists = sections.reduce((sum, section) => {
    const counts = section.list_item_word_counts;
    return sum + (counts && counts.length && (section.unordered_lists + section.definition_lists > 0) ? Number(counts.every((count) => count < 35)) : 0);
  }, 0);
  const outline = sections.filter((section) => section.level === 2 || section.level === 3).length;
  const score = bounded(0.3 * Number(tables > 0) + 0.25 * Number(orderedLists > 0) + 0.15 * Number(conciseLists > 0) + 0.1 * Number(sections.some((section) => section.definition_lists > 0)) + 0.2 * Math.min(1, outline / 4));
  return { score, tables: tableTotal, orderedLists, conciseLists, outline, normalization: ['table requires thead/th when evidence is present', 'ordered list counts only when attached to an instruction', 'ul/dl items must be shorter than 35 words'] };
};

export const extractabilityOf = (sections: RagSection[]): number => extractabilityDetails(sections).score;
