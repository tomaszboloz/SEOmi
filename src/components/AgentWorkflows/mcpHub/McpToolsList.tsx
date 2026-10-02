import React from 'react';
import { useTranslation } from 'react-i18next';
import { Code2, Terminal } from 'lucide-react';
import { McpDiscoveryResult } from './mcpHubTypes';

interface ToolItem {
  id: string;
  name: string;
  description: string | null;
  input: string;
  icon: React.ElementType;
  inputSchema: Record<string, unknown>;
}

interface McpToolsListProps {
  toolsList: ToolItem[];
  selectedToolId: string;
  setSelectedToolId: (id: string) => void;
  discovery: McpDiscoveryResult | null;
}

export const McpToolsList: React.FC<McpToolsListProps> = ({ toolsList, selectedToolId, setSelectedToolId, discovery }) => {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <h3 className="font-bold text-white text-base flex items-center gap-2">
          <Code2 className="w-4 h-4 text-emerald-400" />
          <span>{t('mcp.toolsTitle')}</span>
        </h3>
        <div className="space-y-3">
          {toolsList.map((tool) => {
            const Icon = tool.icon;
            const isSelected = selectedToolId === tool.id;
            return (
              <div key={tool.id} onClick={() => setSelectedToolId(tool.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedToolId(tool.id); } }} className={`p-4 rounded-xl border transition cursor-pointer flex items-start space-x-3 ${isSelected ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'}`}>
                <div className={`p-2 rounded-lg ${isSelected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}><Icon className="w-4 h-4" /></div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sm text-white">{tool.name}</span>
                    {isSelected && <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium">{t('mcp.selected')}</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{tool.description}</p>
                  <p className="mt-2 font-mono text-[10px] text-slate-500">{t('mcp.arguments')}: {tool.input}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="space-y-4">
        <h3 className="font-bold text-white text-base flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span>{t('mcp.invocationTitle')}</span>
        </h3>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4 shadow-md">
          <p className="font-mono text-sm font-semibold text-emerald-200">{toolsList.find((tl) => tl.id === selectedToolId)?.name}</p>
          <p className="text-xs leading-5 text-slate-300">{toolsList.find((tl) => tl.id === selectedToolId)?.description}</p>
          <p className="text-xs leading-5 text-slate-400">{t('mcp.arguments')}: <code className="font-mono text-slate-300">{toolsList.find((tl) => tl.id === selectedToolId)?.input}</code></p>
          {discovery && <details className="rounded-lg border border-slate-800 bg-slate-950/50">
            <summary className="cursor-pointer px-3 py-2 text-[11px] font-medium text-slate-300">{t('mcp.inputSchema')}</summary>
            <pre className="max-h-64 overflow-auto border-t border-slate-800 p-3 text-[10px] leading-relaxed text-sky-100">{JSON.stringify(toolsList.find((tl) => tl.id === selectedToolId)?.inputSchema ?? {}, null, 2)}</pre>
          </details>}
          {['seomi_audit_url', 'seomi_crawl_site'].includes(selectedToolId) ? <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-100">{t('mcp.localToolNotice')}</p> : ['seomi_gsc_search_analytics', 'seomi_gsc_url_inspection'].includes(selectedToolId) ? <p className="rounded-lg border border-sky-500/25 bg-sky-500/5 p-3 text-xs text-sky-100">{t('mcp.gscToolNotice')}</p> : <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-amber-100">{t('mcp.dataforseoToolNotice')}</p>}
          <p className="text-[11px] text-slate-500">{t('mcp.clientOnlyNotice')}</p>
        </div>
      </div>
    </div>
  );
};
