import type { AiProvider } from '@/types';
import i18n from '@/i18n';

export const aiProviderLabel = (provider: AiProvider): string =>
  i18n.t(
    provider === 'openai'
      ? 'legacyUi.ai.openai'
      : provider === 'claude'
        ? 'legacyUi.ai.claude'
        : 'legacyUi.ai.gemini',
  );

