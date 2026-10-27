import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('exports the additional GA4 evidence contracts without changing the legacy contract set', () => {
  const source = ts.createSourceFile('ga4.ts', readFileSync('src/types/ga4.ts', 'utf8'), ts.ScriptTarget.Latest, true);
  const names = source.statements.map(node => {
    expect(ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)).toBe(true);
    return (node as ts.InterfaceDeclaration | ts.TypeAliasDeclaration).name.text;
  });
  expect(names.sort()).toEqual(['Ga4DateRange', 'Ga4Discovery', 'Ga4JoinedRow', 'Ga4JoinResult', 'Ga4Property', 'Ga4Report', 'Ga4ReportRow', 'Ga4Snapshot', 'Ga4Status'].sort());
  const status = source.statements.find(node => ts.isTypeAliasDeclaration(node) && node.name.text === 'Ga4Status') as ts.TypeAliasDeclaration;
  expect(status.type.getText(source)).toBe("'complete' | 'missing' | 'partial'");
});
