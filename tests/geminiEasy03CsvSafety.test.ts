import { describe, expect, it } from 'vitest';
import { csv, escapeCsv, exportHeaders, exportText, spreadsheetSafe } from '@/services/export/csv';

describe('CSV export safety: formula injection neutralization', () => {
  it('neutralizes all standard spreadsheet formula triggers with leading apostrophe', () => {
    expect(spreadsheetSafe('=SUM(A1:B10)')).toBe("'=SUM(A1:B10)");
    expect(spreadsheetSafe('+cmd|/C calc!A0')).toBe("'+cmd|/C calc!A0");
    expect(spreadsheetSafe('-2+3*cmd|/C calc!A0')).toBe("'-2+3*cmd|/C calc!A0");
    expect(spreadsheetSafe('@SUM(1,2)')).toBe("'@SUM(1,2)");
    expect(spreadsheetSafe('-10')).toBe("'-10");
  });

  it('neutralizes formula injection attempts preceded by any leading whitespace variant', () => {
    expect(spreadsheetSafe('   =SUM(A1)')).toBe("'   =SUM(A1)");
    expect(spreadsheetSafe('\t+cmd')).toBe("'\t+cmd");
    expect(spreadsheetSafe('\r-exec')).toBe("'\r-exec");
    expect(spreadsheetSafe('\n@calc')).toBe("'\n@calc");
    expect(spreadsheetSafe(' \t\r\n =ALERT(1)')).toBe("' \t\r\n =ALERT(1)");
    expect(spreadsheetSafe('  \r\n\t  @INJECTION')).toBe("'  \r\n\t  @INJECTION");
  });

  it('leaves legitimate mid-text symbols, numbers and whitespace without modification', () => {
    expect(spreadsheetSafe('user@example.com')).toBe('user@example.com');
    expect(spreadsheetSafe('1+1=2')).toBe('1+1=2');
    expect(spreadsheetSafe('SEO-Audit-2026')).toBe('SEO-Audit-2026');
    expect(spreadsheetSafe('A = B + C')).toBe('A = B + C');
    expect(spreadsheetSafe('item+')).toBe('item+');
    expect(spreadsheetSafe('price-')).toBe('price-');
    expect(spreadsheetSafe('contact@')).toBe('contact@');
    expect(spreadsheetSafe('formula=')).toBe('formula=');
    expect(spreadsheetSafe('   ')).toBe('   ');
    expect(spreadsheetSafe('\t\r\n')).toBe('\t\r\n');
    expect(spreadsheetSafe('Standard safe text')).toBe('Standard safe text');
    expect(spreadsheetSafe('#anchor')).toBe('#anchor');
    expect(spreadsheetSafe('!important')).toBe('!important');
    expect(spreadsheetSafe('$100')).toBe('$100');
  });

  it('handles non-string primitives, null, undefined and objects safely', () => {
    expect(spreadsheetSafe(null)).toBe('');
    expect(spreadsheetSafe(undefined)).toBe('');
    expect(spreadsheetSafe(0)).toBe('0');
    expect(spreadsheetSafe(42)).toBe('42');
    expect(spreadsheetSafe(true)).toBe('true');
    expect(spreadsheetSafe(false)).toBe('false');
  });
});

describe('CSV cell escaping and encoding integrity', () => {
  it('wraps values in quotes and escapes internal double-quotes by doubling them', () => {
    expect(escapeCsv('simple')).toBe('"simple"');
    expect(escapeCsv('Needs "quotes"')).toBe('"Needs ""quotes"""');
    expect(escapeCsv('"enclosed"')).toBe('"""enclosed"""');
    expect(escapeCsv('""')).toBe('""""""');
    expect(escapeCsv('')).toBe('""');
    expect(escapeCsv(null)).toBe('""');
  });

  it('correctly combines formula neutralization with double-quote escaping', () => {
    expect(escapeCsv('=HYPERLINK("https://evil.example","Click")'))
      .toBe('"\'=HYPERLINK(""https://evil.example"",""Click"")"');
    expect(escapeCsv(' \t+cmd|"/C calc"!"A1"'))
      .toBe('"\' \t+cmd|""/C calc""!""A1"""');
  });

  it('preserves embedded newlines, carriage returns and tabs inside quotes', () => {
    expect(escapeCsv('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCsv('line1\r\nline2')).toBe('"line1\r\nline2"');
    expect(escapeCsv('col1\tcol2')).toBe('"col1\tcol2"');
  });

  it('preserves multi-byte Unicode characters, emojis and RTL text accurately', () => {
    const polish = 'Gdańsk, Kraków, Łódź, Poznań, Żółć';
    const cjk = '日本語タイトル - 検索エンジン最適化';
    const emojis = 'Rocket 🚀 & Warning ⚠️';
    const rtl = 'تقرير تحسين محركات البحث';

    expect(escapeCsv(polish)).toBe(`"${polish}"`);
    expect(escapeCsv(cjk)).toBe(`"${cjk}"`);
    expect(escapeCsv(emojis)).toBe(`"${emojis}"`);
    expect(escapeCsv(rtl)).toBe(`"${rtl}"`);
    expect(escapeCsv(`=${polish}`)).toBe(`"'=${polish}"`);
  });
});

describe('CSV tabular matrix generation and i18n helpers', () => {
  it('formats tabular matrices conforming to RFC 4180 CRLF rows and comma columns', () => {
    const table = [
      ['URL', 'Score', 'Title'],
      ['https://example.com', 95, 'Safe Title'],
      ['https://example.com/exploit', 40, '=SUM(A1:B1)'],
      ['https://example.com/quotes', 70, 'Has "quotes" and, commas'],
    ];

    const result = csv(table);
    const rows = result.split('\r\n');
    expect(rows).toHaveLength(4);
    expect(rows[0]).toBe('"URL","Score","Title"');
    expect(rows[1]).toBe('"https://example.com","95","Safe Title"');
    expect(rows[2]).toBe('"https://example.com/exploit","40","\'=SUM(A1:B1)"');
    expect(rows[3]).toBe('"https://example.com/quotes","70","Has ""quotes"" and, commas"');
  });

  it('handles empty matrices and empty rows cleanly', () => {
    expect(csv([])).toBe('');
    expect(csv([[]])).toBe('');
    expect(csv([['a'], []])).toBe('"a"\r\n');
    expect(csv([['']])).toBe('""');
  });

  it('reads translated headers and UI text correctly', () => {
    const auditFields = exportHeaders('auditFields');
    expect(Array.isArray(auditFields)).toBe(true);
    expect(auditFields.length).toBeGreaterThan(0);
    expect(auditFields).toContain('URL');

    expect(exportHeaders('unknownKeyThatDoesNotExist')).toEqual([]);
    expect(exportText('invalidPdf')).toBeTruthy();
  });
});
