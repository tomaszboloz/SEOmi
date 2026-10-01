import { AiConnectionMethod, AiProvider, PageAuditData } from '@/types';
import { invokeTauriCommand } from '@/services/tauri';
import i18n from '@/i18n';

const aiProviderLabel = (provider: AiProvider): string =>
  i18n.t(
    provider === 'openai'
      ? 'legacyUi.ai.openai'
      : provider === 'claude'
        ? 'legacyUi.ai.claude'
        : 'legacyUi.ai.gemini',
  );

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

export class AIService {
  static async generateText(provider: AiProvider, apiKey: string, model: string, prompt: string, method: AiConnectionMethod = 'api_key'): Promise<string> {
    // A subscription CLI owns its own model selection and authentication.
    // Do not force the API-oriented model name from this UI onto Codex,
    // Claude Code or Gemini CLI: that would make an already logged-in CLI fail
    // despite a valid subscription.
    if (method === 'local_cli') return invokeTauriCommand<string>('run_ai_cli', { provider, prompt });
    if (!apiKey.trim()) throw new Error(i18n.t('runtimeErrors.ai.credentialMissing', { provider: aiProviderLabel(provider) }));
    if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0 }) });
      if (!response.ok) throw new Error(i18n.t('runtimeErrors.ai.apiError', { provider: aiProviderLabel('openai'), status: response.status, detail: await response.text() }));
      return (await response.json()).choices?.[0]?.message?.content || '';
    }
    if (provider === 'claude') {
      const response = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model, max_tokens: 1200, messages: [{ role: 'user', content: prompt }] }) });
      if (!response.ok) throw new Error(i18n.t('runtimeErrors.ai.apiError', { provider: aiProviderLabel('claude'), status: response.status, detail: await response.text() }));
      return (await response.json()).content?.[0]?.text || '';
    }
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
    if (!response.ok) throw new Error(i18n.t('runtimeErrors.ai.apiError', { provider: aiProviderLabel('gemini'), status: response.status, detail: await response.text() }));
    return (await response.json()).candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  /**
   * Generates comprehensive SEO metadata suggestions using OpenAI, Claude, or Gemini
   */
  static async generateSuggestions(
    provider: AiProvider,
    apiKey: string,
    model: string,
    auditData: PageAuditData,
    customInstruction?: string,
    method: AiConnectionMethod = 'api_key',
  ): Promise<AiSuggestionResponse> {
    if (method === 'local_cli') {
      const text = await invokeTauriCommand<string>('run_ai_cli', { provider, prompt: this.buildPrompt(auditData, customInstruction) });
      return parseAiSuggestionResponse(text);
    }
    if (!apiKey.trim()) {
      throw new Error(i18n.t('runtimeErrors.ai.configureKey'));
    }

    const prompt = this.buildPrompt(auditData, customInstruction);

    switch (provider) {
      case 'openai':
        return this.callOpenAI(apiKey, model || 'gpt-4o', prompt);
      case 'claude':
        return this.callClaude(apiKey, model || 'claude-3-7-sonnet-20250219', prompt);
      case 'gemini':
        return this.callGemini(apiKey, model || 'gemini-2.0-flash', prompt);
      default:
        throw new Error(i18n.t('runtimeErrors.ai.unsupportedProvider', { provider }));
    }
  }

  private static buildPrompt(audit: PageAuditData, customInstruction?: string): string {
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

  private static async callOpenAI(
    apiKey: string,
    model: string,
    prompt: string
  ): Promise<AiSuggestionResponse> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      if (res.status === 401) {
        throw new Error(i18n.t('runtimeErrors.ai.authFailed', { provider: aiProviderLabel('openai') }));
      }
      if (res.status === 429) {
        throw new Error(i18n.t('runtimeErrors.ai.quota', { provider: aiProviderLabel('openai'), host: 'platform.openai.com' }));
      }
        throw new Error(i18n.t('runtimeErrors.ai.apiError', { provider: aiProviderLabel('openai'), status: res.status, detail: err }));
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    return parseAiSuggestionResponse(content || '');
  }

  private static async callClaude(
    apiKey: string,
    model: string,
    prompt: string
  ): Promise<AiSuggestionResponse> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      if (res.status === 401) {
        throw new Error(i18n.t('runtimeErrors.ai.authFailed', { provider: aiProviderLabel('claude') }));
      }
      if (res.status === 429) {
        throw new Error(i18n.t('runtimeErrors.ai.quota', { provider: aiProviderLabel('claude'), host: 'console.anthropic.com' }));
      }
        throw new Error(i18n.t('runtimeErrors.ai.apiError', { provider: aiProviderLabel('claude'), status: res.status, detail: err }));
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    return parseAiSuggestionResponse(text);
  }

  private static async callGemini(
    apiKey: string,
    model: string,
    prompt: string
  ): Promise<AiSuggestionResponse> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      if (res.status === 400 || res.status === 403) {
        throw new Error(i18n.t('runtimeErrors.ai.authFailed', { provider: aiProviderLabel('gemini') }));
      }
      if (res.status === 429) {
        throw new Error(i18n.t('runtimeErrors.ai.quota', { provider: aiProviderLabel('gemini'), host: 'aistudio.google.com' }));
      }
      throw new Error(i18n.t('runtimeErrors.ai.apiError', { provider: aiProviderLabel('gemini'), status: res.status, detail: err }));
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return parseAiSuggestionResponse(text);
  }

  /**
   * Directly verifies that the provider credentials and native subscription are valid
   */
  static async testConnection(
    provider: AiProvider,
    apiKey: string
  ): Promise<{ success: boolean; message: string }> {
    if (!apiKey.trim()) {
      return { success: false, message: i18n.t('runtimeErrors.ai.keyRequired') };
    }

    try {
      if (provider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!res.ok) {
          if (res.status === 401) {
            return { success: false, message: i18n.t('runtimeErrors.ai.invalidKey', { provider: aiProviderLabel('openai') }) };
          }
          if (res.status === 429) {
            return { success: false, message: i18n.t('runtimeErrors.ai.quotaExceeded', { provider: aiProviderLabel('openai') }) };
          }
          return { success: false, message: i18n.t('runtimeErrors.ai.responded', { provider: aiProviderLabel('openai'), status: res.status }) };
        }
        return { success: true, message: i18n.t('runtimeErrors.ai.connected', { provider: aiProviderLabel('openai') }) };
      }

      if (provider === 'claude') {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 5,
            messages: [{ role: 'user', content: 'ping' }],
          }),
        });
        if (!res.ok) {
          if (res.status === 401) {
            return { success: false, message: i18n.t('runtimeErrors.ai.invalidKey', { provider: aiProviderLabel('claude') }) };
          }
          if (res.status === 429) {
            return { success: false, message: i18n.t('runtimeErrors.ai.quotaExceeded', { provider: aiProviderLabel('claude') }) };
          }
          return { success: false, message: i18n.t('runtimeErrors.ai.responded', { provider: aiProviderLabel('claude'), status: res.status }) };
        }
        return { success: true, message: i18n.t('runtimeErrors.ai.connected', { provider: aiProviderLabel('claude') }) };
      }

      if (provider === 'gemini') {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        );
        if (!res.ok) {
          if (res.status === 400 || res.status === 403) {
            return { success: false, message: i18n.t('runtimeErrors.ai.invalidKey', { provider: aiProviderLabel('gemini') }) };
          }
          if (res.status === 429) {
            return { success: false, message: i18n.t('runtimeErrors.ai.quotaExceeded', { provider: aiProviderLabel('gemini') }) };
          }
          return { success: false, message: i18n.t('runtimeErrors.ai.responded', { provider: aiProviderLabel('gemini'), status: res.status }) };
        }
        return { success: true, message: i18n.t('runtimeErrors.ai.connected', { provider: aiProviderLabel('gemini') }) };
      }

      return { success: false, message: i18n.t('runtimeErrors.ai.unsupported') };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: i18n.t('runtimeErrors.ai.network', { detail: msg }) };
    }
  }

  static async testCliConnection(provider: AiProvider): Promise<{ success: boolean; message: string }> {
    try {
      const status = await invokeTauriCommand<{ provider: AiProvider; available: boolean; detail: string }>('test_ai_cli_connection', { provider });
      return status?.available
        ? { success: true, message: i18n.t('runtimeErrors.ai.cliAvailable', { provider: status.provider, detail: status.detail }) }
        : { success: false, message: status?.detail || i18n.t('runtimeErrors.ai.cliMissing') };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
  }
}
