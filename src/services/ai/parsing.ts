import i18n from '@/i18n';

export interface AiSuggestionResponse {
  suggestedTitle: string;
  suggestedDescription: string;
  keyImprovements: string[];
  schemaJsonLd?: Record<string, unknown>;
}

/**
 * Model CLIs and hosted providers occasionally wrap an otherwise valid JSON
 * response in Markdown or add a short explanation before/after it. Keep the
 * parser deterministic and bounded instead of using a greedy regexp which can
 * consume two JSON objects or braces inside a quoted string.
 */
export const extractJsonObject = (value: string): string => {
  const source = value.trim();
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidates = fenced ? [fenced, source] : [source];

  for (const candidate of candidates) {
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // Fall through to the bounded object scanner below.
    }

    let start = -1;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = 0; index < candidate.length; index += 1) {
      const character = candidate[index];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (character === '\\') {
          escaped = true;
        } else if (character === '"') {
          inString = false;
        }
        continue;
      }
      if (character === '"') {
        inString = true;
        continue;
      }
      if (character === '{') {
        if (start === -1) start = index;
        depth += 1;
      } else if (character === '}' && start !== -1) {
        depth -= 1;
        if (depth === 0) {
          const object = candidate.slice(start, index + 1);
          try {
            JSON.parse(object);
            return object;
          } catch {
            start = -1;
          }
        }
      }
    }
  }

  throw new Error(i18n.t('runtimeErrors.ai.invalidJson'));
};

export const parseAiSuggestionResponse = (value: string): AiSuggestionResponse => {
  const parsed: unknown = JSON.parse(extractJsonObject(value));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(i18n.t('runtimeErrors.ai.invalidSuggestion'));
  }
  const candidate = parsed as Partial<AiSuggestionResponse>;
  if (
    typeof candidate.suggestedTitle !== 'string' ||
    typeof candidate.suggestedDescription !== 'string' ||
    !Array.isArray(candidate.keyImprovements) ||
    candidate.keyImprovements.some((item) => typeof item !== 'string')
  ) {
    throw new Error(i18n.t('runtimeErrors.ai.missingSuggestionFields'));
  }
  return {
    suggestedTitle: candidate.suggestedTitle,
    suggestedDescription: candidate.suggestedDescription,
    keyImprovements: candidate.keyImprovements,
    ...(candidate.schemaJsonLd && typeof candidate.schemaJsonLd === 'object' && !Array.isArray(candidate.schemaJsonLd)
      ? { schemaJsonLd: candidate.schemaJsonLd }
      : {}),
  };
};

