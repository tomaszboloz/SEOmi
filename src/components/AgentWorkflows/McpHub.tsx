import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Shield, Layers, Search } from 'lucide-react';
import { useToolsStore } from '@/stores/toolsStore';
import { useProjectStore } from '@/stores/projectStore';
import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri';
import { readStorage, removeStorage, writeStorage } from '@/services/storage';
import { McpDiscoveryResult } from './mcpHub/mcpHubTypes';
import { getBuiltInTools } from './mcpHub/mcpBuiltInTools';
import { McpServerConfigCard } from './mcpHub/McpServerConfigCard';
import { McpToolsList } from './mcpHub/McpToolsList';

export const McpHub: React.FC = () => {
  const { t } = useTranslation();
  const mcpClientTab = useToolsStore((s) => s.mcpClientTab);
  const setMcpClientTab = useToolsStore((s) => s.setMcpClientTab);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);

  const [serverPath, setServerPath] = useState('');
  const [selectedToolId, setSelectedToolId] = useState('seomi_audit_url');
  const [discovery, setDiscovery] = useState<McpDiscoveryResult | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [discoveryError, setDiscoveryError] = useState('');
  const discoveryRequestToken = useRef(0);

  useEffect(() => {
    discoveryRequestToken.current += 1;
    setServerPath(activeProjectId ? readStorage(`seomi_project_${activeProjectId}_mcp_server_path_v1`) || '' : '');
    setDiscovery(null);
    setDiscoveryError('');
    setDiscovering(false);
  }, [activeProjectId]);

  const updateServerPath = (value: string) => {
    discoveryRequestToken.current += 1;
    setServerPath(value);
    setDiscovery(null);
    setDiscoveryError('');
    if (!activeProjectId) return;
    if (value.trim()) writeStorage(`seomi_project_${activeProjectId}_mcp_server_path_v1`, value.trim());
    else removeStorage(`seomi_project_${activeProjectId}_mcp_server_path_v1`);
  };

  const discoverTools = async () => {
    const normalizedServerPath = serverPath.trim();
    const absoluteServerPath = /^(?:[A-Za-z]:[\\/]|\\\\|\/)/.test(normalizedServerPath) && normalizedServerPath.toLocaleLowerCase().endsWith('.js');
    if (!absoluteServerPath || !isTauriEnvironment()) return;
    const projectId = activeProjectId;
    const requestToken = ++discoveryRequestToken.current;
    setDiscovering(true);
    setDiscoveryError('');
    try {
      const result = await invokeTauriCommand<McpDiscoveryResult>('discover_mcp_tools', { serverPath: serverPath.trim() });
      if (useProjectStore.getState().activeProjectId !== projectId || discoveryRequestToken.current !== requestToken) return;
      setDiscovery(result);
      setSelectedToolId((current) => result.tools.some((tool) => tool.name === current) ? current : result.tools[0]?.name ?? '');
    } catch (error) {
      if (useProjectStore.getState().activeProjectId !== projectId || discoveryRequestToken.current !== requestToken) return;
      setDiscovery(null);
      setDiscoveryError(error instanceof Error ? error.message : String(error));
    } finally {
      if (useProjectStore.getState().activeProjectId === projectId && discoveryRequestToken.current === requestToken) setDiscovering(false);
    }
  };

  const builtInTools = getBuiltInTools(t);
  const toolsList = discovery
    ? discovery.tools.map((tool) => ({
      ...tool, id: tool.name, input: Object.keys((tool.inputSchema.properties as Record<string, unknown> | undefined) ?? {}).join(', ') || t('mcp.noArguments'),
      icon: tool.name.includes('backlink') ? Shield : tool.name.includes('audit') ? Layers : Search,
    }))
    : builtInTools.map((tool) => ({ ...tool, inputSchema: { type: 'object', properties: {} } }));

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">{t('mcp.badge')}</span>
            <span className="text-xs text-slate-400 font-mono">{t('mcp.protocol')}</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">{t('mcp.title')}</h1>
          <p className="text-sm text-slate-400">{t('mcp.description')}</p>
        </div>
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{discovery ? t('mcp.discoveredSummary', { count: discovery.tools.length, server: discovery.serverName, version: discovery.serverVersion }) : t('mcp.builtInSummary', { count: builtInTools.length })}</span>
        </div>
      </div>
      <McpServerConfigCard mcpClientTab={mcpClientTab} setMcpClientTab={setMcpClientTab} serverPath={serverPath} updateServerPath={updateServerPath} discoverTools={discoverTools} discovering={discovering} discoveryError={discoveryError} />
      <McpToolsList toolsList={toolsList} selectedToolId={selectedToolId} setSelectedToolId={setSelectedToolId} discovery={discovery} />
    </div>
  );
};
