import React from 'react';
import { useTranslation } from 'react-i18next';

interface McpClientTabsProps {
  mcpClientTab: 'claude' | 'cursor' | 'codex' | 'gemini';
  onTabChange: (tab: 'claude' | 'cursor' | 'codex' | 'gemini') => void;
}

export const McpClientTabs: React.FC<McpClientTabsProps> = ({ mcpClientTab, onTabChange }) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center space-x-2">
      {(['claude', 'cursor', 'codex', 'gemini'] as const).map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={`text-xs px-3 py-1.5 rounded-lg transition font-medium ${
            mcpClientTab === tab
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent'
          }`}
        >
          {tab === 'claude' ? t('mcp.clientClaude') : tab === 'cursor' ? t('mcp.clientCursor') : tab === 'gemini' ? t('mcp.clientGemini') : t('mcp.clientCodex')}
        </button>
      ))}
    </div>
  );
};
