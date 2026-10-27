import { buildHtaccess } from './apache';
import { buildCloudflareCsv } from './cloudflare';
import { buildNginx } from './nginx';
import { validateRules } from './rules';
import { buildWpRedirectionCsv, buildWpRedirectionJson } from './wpRedirection';
import { buildZip } from './zip';
import type { ArtifactFile, RedirectRule, RuleIssue } from './types';

export interface DeploymentBundle {
  files: ArtifactFile[];
  issues: RuleIssue[];
  ruleCount: number;
}

/** Validates once, then renders every format from the same clean rule set. */
export const buildDeploymentBundle = (input: RedirectRule[]): DeploymentBundle => {
  const { rules, issues } = validateRules(input);
  const files = [buildHtaccess(rules), buildNginx(rules), buildCloudflareCsv(rules), buildWpRedirectionCsv(rules), buildWpRedirectionJson(rules)];
  const unsupported = files.flatMap((file) => file.skipped ?? []);
  return { files, issues: [...issues, ...unsupported], ruleCount: rules.length };
};

export const bundleToZip = (bundle: DeploymentBundle): Uint8Array => buildZip(bundle.files.map(({ name, content }) => ({ name, content })));
