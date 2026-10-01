import type { PageAuditData } from '@/types';

  export function buildAiPrompt(audit: PageAuditData, customInstruction?: string): string {
    const title = audit.meta_tags.title || '(missing)';
    const desc = audit.meta_tags.description || '(missing)';
    const h1 = audit.headings.h1_texts.join(' | ') || '(missing)';
    const topKeywords = audit.content_stats.top_keywords.map((k) => `${k.keyword} (${k.count})`).join(', ');

    return `You are an elite technical SEO copywriter.
Analyze this webpage audit data and generate high-converting, optimal SEO metadata:

URL: ${audit.final_url}
Current Title (${audit.meta_tags.title_length} chars): "${title}"
Current Description (${audit.meta_tags.description_length} chars): "${desc}"
H1 Heading: "${h1}"
Top Extracted Content Keywords: ${topKeywords || 'None'}
${customInstruction ? `User Specific Instruction: ${customInstruction}` : ''}

Requirements:
1. Suggested Title must be 50-60 characters, highly click-worthy, containing primary intent keywords.
2. Suggested Description must be 135-155 characters with a compelling call-to-action.
3. List 3 key actionable improvements.
4. Output Schema.org WebPage / Article JSON-LD markup.

Respond STRICTLY in valid JSON matching this exact schema:
{
  "suggestedTitle": "...",
  "suggestedDescription": "...",
  "keyImprovements": ["improvement 1", "improvement 2", "improvement 3"],
  "schemaJsonLd": { ... }
}`;
  }
