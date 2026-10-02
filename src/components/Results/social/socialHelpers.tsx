import React from 'react';
import { readJsonRecord } from '@/services/storageContracts';
import { SerpDraft } from './socialTypes';

export const serpDraftKey = (projectId: string | null, url: string) => projectId
  ? `seomi_serp_preview_${projectId}_${encodeURIComponent(url)}`
  : null;

export const readSerpDraft = (key: string | null, fallback: SerpDraft): SerpDraft => {
  if (!key) return fallback;
  try {
    const stored = readJsonRecord(key);
    if (!stored || typeof stored !== 'object') return fallback;
    return {
      title: typeof stored.title === 'string' ? stored.title : fallback.title,
      description: typeof stored.description === 'string' ? stored.description : fallback.description,
      image: typeof stored.image === 'string' ? stored.image : fallback.image,
      query: typeof stored.query === 'string' ? stored.query : fallback.query,
    };
  } catch {
    return fallback;
  }
};

export const highlightQuery = (text: string, query: string): React.ReactNode => {
  const terms = query.trim().split(/\s+/u).filter(Boolean);
  if (!terms.length) return text;
  const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'));
  const matcher = new RegExp(`(${escaped.join('|')})`, 'giu');
  return text.split(matcher).map((part, index) => terms.some((term) => term.toLocaleLowerCase() === part.toLocaleLowerCase())
    ? <strong key={`${index}-${part}`} className="font-semibold text-[#202124]">{part}</strong>
    : part);
};
