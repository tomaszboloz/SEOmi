import React from 'react';
import { Bot, Flame, Sparkles } from 'lucide-react';
import type { AiProvider } from '@/types';

export interface ProviderModelChoice {
  id: string;
  labelKey: string;
}

export interface ProviderDefinition {
  id: AiProvider;
  nameKey: string;
  command: string;
  icon: React.ElementType;
  models: ProviderModelChoice[];
  apiHelp: string;
}

export const PROVIDERS_CONFIG: ProviderDefinition[] = [
  {
    id: 'openai',
    nameKey: 'legacyUi.ai.openai',
    command: 'codex',
    icon: Bot,
    apiHelp: 'https://platform.openai.com/api-keys',
    models: [
      { id: 'gpt-4o', labelKey: 'legacyUi.ai.gpt4o' },
      { id: 'gpt-4o-mini', labelKey: 'legacyUi.ai.gpt4oMini' },
      { id: 'o3-mini', labelKey: 'legacyUi.ai.o3Mini' },
    ],
  },
  {
    id: 'claude',
    nameKey: 'legacyUi.ai.claude',
    command: 'claude',
    icon: Flame,
    apiHelp: 'https://console.anthropic.com/settings/keys',
    models: [
      { id: 'claude-3-7-sonnet-20250219', labelKey: 'legacyUi.ai.claude37' },
      { id: 'claude-3-5-haiku-20241022', labelKey: 'legacyUi.ai.claudeHaiku' },
    ],
  },
  {
    id: 'gemini',
    nameKey: 'legacyUi.ai.gemini',
    command: 'gemini',
    icon: Sparkles,
    apiHelp: 'https://aistudio.google.com/app/apikey',
    models: [
      { id: 'gemini-2.0-flash', labelKey: 'legacyUi.ai.geminiFlash' },
      { id: 'gemini-1.5-pro', labelKey: 'legacyUi.ai.gemini15' },
    ],
  },
];
