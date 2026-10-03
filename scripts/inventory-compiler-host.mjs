import ts from 'typescript';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { normalize, sourceHashes } from './inventory-utils.mjs';

/** Resolve calls into compiled MCP modules only when emitted/source bytes are fresh. */
export function sourceAwareCompilerHost(options, sourceManifest, runtimeManifest) {
  const host = ts.createCompilerHost(options);
  host.resolveModuleNames = (names, containingFile) => names.map(name => {
    const resolved = ts.resolveModuleName(name, containingFile, options, host).resolvedModule;
    if (!resolved || !normalize(resolved.resolvedFileName).startsWith('mcp-server/dist/') || !resolved.resolvedFileName.endsWith('.js')) return resolved;
    const runtime = normalize(resolved.resolvedFileName);
    const mapFile = `${runtime}.map`;
    if (!runtimeManifest?.[runtime] || !runtimeManifest?.[mapFile]) return resolved;
    if (!existsSync(mapFile)) return resolved;
    const hashes = sourceHashes([runtime, mapFile]);
    if (hashes[runtime] !== runtimeManifest[runtime] || hashes[mapFile] !== runtimeManifest[mapFile]) return resolved;
    try {
      const map = JSON.parse(readFileSync(mapFile, 'utf8'));
      if (map.sources?.length !== 1 || map.sourcesContent?.length !== 1) return resolved;
      const original = resolve(dirname(resolve(runtime)), map.sourceRoot || '', map.sources[0]);
      const file = normalize(original);
      if (!sourceManifest?.[file] || !file.startsWith('mcp-server/src/') || !existsSync(original)) return resolved;
      if (sourceHashes([original])[file] !== sourceManifest[file] || readFileSync(original, 'utf8') !== map.sourcesContent[0]) return resolved;
      return { ...resolved, resolvedFileName: original, extension: ts.Extension.Ts };
    } catch {
      return resolved;
    }
  });
  return host;
}
