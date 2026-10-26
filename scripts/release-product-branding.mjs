import { readFileSync } from 'node:fs';

const PRODUCT_PATH = /^(?:src\/|src-tauri\/|mcp-server\/|public\/|README\.md$|package\.json$)/;
const FORBIDDEN_REFERENCE = /\bopen[ -]?seo\b|every-app|openseo\.so/i;

export const assertIndependentProductSources = (files, read = readFileSync) => {
  const forbidden = [];
  for (const file of files.filter((path) => PRODUCT_PATH.test(path))) {
    const bytes = read(file);
    if (FORBIDDEN_REFERENCE.test(bytes.toString('utf8'))) forbidden.push(file);
  }
  if (forbidden.length) throw new Error(`Forbidden source branding/reference found in product files:\n${forbidden.join('\n')}`);
};
