import React from 'react';
import { Bot, Flame, Sparkles } from 'lucide-react';
import type { AiProvider } from '@/types';

export interface ProviderDefinition {
  id: AiProvider;
  nameKey: string;
  command: string;
  icon: React.ElementType;
  apiHelp: string;
}

export const PROVIDERS_CONFIG: ProviderDefinition[] = [
  {
    id: 'openai',
    nameKey: 'legacyUi.ai.openai',
    command: 'codex',
    icon: Bot,
    apiHelp: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'claude',
    nameKey: 'legacyUi.ai.claude',
    command: 'claude',
    icon: Flame,
    apiHelp: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'gemini',
    nameKey: 'legacyUi.ai.gemini',
    command: 'gemini',
    icon: Sparkles,
    apiHelp: 'https://aistudio.google.com/app/apikey',
  },
];
