/** RFC 4180 field; leading =,+,-,@ are neutralized against spreadsheet formula injection. */
export const csvField = (value: string | number | boolean): string => {
  const text = String(value);
  const safe = /^[=+\-@\t\r]/.test(text) && !/^https?:\/\//.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export const csvRows = (rows: Array<Array<string | number | boolean>>): string => `${rows.map((row) => row.map(csvField).join(',')).join('\r\n')}\r\n`;
