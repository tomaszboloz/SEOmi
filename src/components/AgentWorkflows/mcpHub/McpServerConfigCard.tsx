import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Terminal, Check, Copy, AlertTriangle, Search } from 'lucide-react';
import { McpClientTabs } from './McpClientTabs';
import { getActiveConfigString } from './mcpHubTypes';
import { copyText } from '@/services/clipboard';
import { saveTextFile, isTauriEnvironment } from '@/services/tauri';

interface McpServerConfigCardProps {
  mcpClientTab: 'claude' | 'cursor' | 'codex' | 'gemini';
  setMcpClientTab: (tab: 'claude' | 'cursor' | 'codex' | 'gemini') => void;
  serverPath: string;
  updateServerPath: (path: string) => void;
  discoverTools: () => void;
  discovering: boolean;
  discoveryError: string;
}

export const McpServerConfigCard: React.FC<McpServerConfigCardProps> = ({
  mcpClientTab, setMcpClientTab, serverPath, updateServerPath, discoverTools, discovering, discoveryError,
}) => {
  const { t } = useTranslation();
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [exportedConfig, setExportedConfig] = useState(false);
  const [exportingConfig, setExportingConfig] = useState(false);
  const [exportError, setExportError] = useState(false);

  const normalizedServerPath = serverPath.trim();
  const absoluteServerPath = /^(?:[A-Za-z]:[\\/]|\\\\|\/)/.test(normalizedServerPath) && normalizedServerPath.toLocaleLowerCase().endsWith('.js');
  const activeConfigString = getActiveConfigString(mcpClientTab, serverPath);
  const configExtension = mcpClientTab === 'codex' ? 'toml' : 'json';
  const configFilename = `seomi-mcp-${mcpClientTab}.${configExtension}`;

  const handleCopyConfig = async () => {
    const copied = await copyText(activeConfigString);
    if (!copied) return;
    setCopiedConfig(true);
    setTimeout(() => setCopiedConfig(false), 2000);
  };

  const handleExportConfig = async () => {
    if (!absoluteServerPath) return;
    setExportingConfig(true);
    try {
      const result = await saveTextFile({ defaultPath: configFilename, contents: activeConfigString, extension: configExtension, filterName: configExtension === 'json' ? t('mcp.jsonFileType') : t('mcp.tomlFileType') });
      if (result === 'cancelled') { setExportError(false); return; }
      setExportError(false); setExportedConfig(true); setTimeout(() => setExportedConfig(false), 2000);
    } catch {
      setExportedConfig(false); setExportError(true);
    } finally {
      setExportingConfig(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <h3 className="font-bold text-white text-sm">{t('mcp.clientConfig')}</h3>
        </div>
        <McpClientTabs mcpClientTab={mcpClientTab} onTabChange={(t) => { setMcpClientTab(t); setExportedConfig(false); setExportingConfig(false); setExportError(false); }} />
      </div>
      <label className="block text-xs text-slate-300">{t('mcp.serverPathLabel')}
        <input aria-label={t('mcp.serverPathAria')} value={serverPath} onChange={(e) => updateServerPath(e.target.value)} placeholder={navigator.platform.toLocaleLowerCase().includes('win') ? t('mcp.serverPathWindows') : t('mcp.serverPathMac')} className="mt-1.5 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 font-mono text-xs text-white outline-none focus:border-emerald-400" />
      </label>
      <div className="relative">
        <pre className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs text-emerald-400 font-mono overflow-x-auto leading-relaxed">{absoluteServerPath ? activeConfigString : t('mcp.configMissing')}</pre>
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <button type="button" onClick={handleExportConfig} disabled={!absoluteServerPath || exportingConfig} className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition disabled:cursor-not-allowed disabled:opacity-50">
            <span>{exportingConfig ? t('mcp.exportingConfig') : exportedConfig ? t('mcp.exportedConfig') : t('mcp.exportConfig')}</span>
          </button>
          <button type="button" onClick={handleCopyConfig} disabled={!absoluteServerPath} className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 flex items-center space-x-1.5 transition disabled:cursor-not-allowed disabled:opacity-50">
            {copiedConfig ? <><Check className="w-3.5 h-3.5 text-emerald-400" /><span>{t('mcp.copied')}</span></> : <><Copy className="w-3.5 h-3.5 text-slate-400" /><span>{t('mcp.copyConfig')}</span></>}
          </button>
        </div>
      </div>
      {exportError && <p role="alert" className="rounded-lg border border-rose-500/25 bg-rose-500/5 p-3 text-xs text-rose-100">{t('mcp.exportError')}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={discoverTools} disabled={!absoluteServerPath || !isTauriEnvironment() || discovering} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-sky-400/30 bg-sky-400/10 px-3 text-xs font-medium text-sky-100 outline-none transition hover:bg-sky-400/15 focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-50">
          <Search className="h-3.5 w-3.5" aria-hidden="true" />{discovering ? t('mcp.discovering') : t('mcp.discover')}
        </button>
        <span className="text-[11px] text-slate-500">{t('mcp.discoverNotice')}</span>
      </div>
      {discoveryError && <p role="alert" className="rounded-lg border border-rose-500/25 bg-rose-500/5 p-3 text-xs text-rose-100">{t('mcp.discoveryError')}: {discoveryError}</p>}
      {!isTauriEnvironment() && <p role="status" className="text-[11px] text-amber-200">{t('mcp.desktopRequired')}</p>}
      <p className="text-xs text-slate-400">{mcpClientTab === 'claude' && t('mcp.instructionsClaude')}{mcpClientTab === 'cursor' && t('mcp.instructionsCursor')}{mcpClientTab === 'codex' && t('mcp.instructionsCodex')}{mcpClientTab === 'gemini' && t('mcp.instructionsGemini')}</p>
      {!absoluteServerPath && <p role="status" className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-amber-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{t('mcp.buildRequired')}</p>}
      <p className="text-[11px] text-slate-500">{t('mcp.nodeRequired')}</p>
      <p role="note" className="text-[11px] text-slate-500">{t('mcp.exportConfigNotice')}</p>
    </div>
  );
};
