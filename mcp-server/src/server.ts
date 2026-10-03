import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createRequire } from 'node:module';
import { validatePublicTarget } from './httpSafety.js';
import { auditPublicUrl, crawlPublicSite } from './auditWorkflow.js';
import { createProviderClient } from './providers.js';
import { registerAuditTools } from './toolsAudit.js';
import { registerGoogleTools } from './toolsGoogle.js';
import { registerBacklinkTools } from './toolsBacklinks.js';
import { registerResearchTools } from './toolsResearch.js';

export interface ServerDependencies {
  providers?: ReturnType<typeof createProviderClient>;
  audit?: typeof auditPublicUrl;
  crawl?: typeof crawlPublicSite;
  publicTarget?: (value: string) => Promise<string>;
}

export const createSeoMiServer = (dependencies: ServerDependencies = {}): McpServer => {
  const { dataForSeo, googleJson, googleApiKey, googlePublicJson } = dependencies.providers ?? createProviderClient();
  const audit = dependencies.audit ?? auditPublicUrl;
  const crawl = dependencies.crawl ?? crawlPublicSite;
  const publicTargetUrl = dependencies.publicTarget ?? (async (value: string): Promise<string> => {
    const target = await validatePublicTarget(value);
    return target.url.toString();
  });

  const packageJson = createRequire(import.meta.url)('../package.json') as { version: string };
  const server = new McpServer({ name: 'seomi-mcp-server', version: packageJson.version });

  registerAuditTools(server, audit, crawl);
  registerGoogleTools(server, { googleJson, googleApiKey, googlePublicJson, publicTargetUrl });
  registerBacklinkTools(server, dataForSeo);
  registerResearchTools(server, dataForSeo);

  return server;
};
