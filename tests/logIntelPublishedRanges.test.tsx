import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { importAccessLog, inRanges, verifyBot } from '@/services/logIntelligence';
import { isValidCidr, parseAddress } from '@/services/logIntelligence/ipRanges';
import { parsePublishedRanges, rangesByFamily, readPublishedRanges, savePublishedRanges } from '@/services/logIntelligence/publishedRanges';
import { readLogState, saveLogState } from '@/services/logIntelligence/storage';
import { BotVerificationEvidence } from '@/components/Domain/crawlResults/logIntelligence/BotVerificationEvidence';

const FILE = JSON.stringify({ creationTime: '2026-10-01T00:00:00Z', prefixes: [{ ipv4Prefix: '20.15.240.64/28' }, { ipv6Prefix: '2a03:2880:f000::/36' }, { ipv4Prefix: 'bad' }] });
const line = (ip: string, ua: string) => `${ip} - - [10/Oct/2026:13:55:36 +0000] "GET /a HTTP/1.1" 200 10 "-" "${ua}"`;

beforeEach(async () => { localStorage.clear(); await i18n.changeLanguage('en'); });
afterEach(cleanup);

describe('IPv4 and IPv6 published ranges (#92)', () => {
  it('matches CIDRs per address family and rejects malformed input', () => {
    expect(parseAddress('::ffff:1.2.3.4')).not.toBeNull();
    expect(parseAddress('1.2.3')).toBeNull();
    expect(parseAddress('2001:db8::1::2')).toBeNull();
    expect(isValidCidr('2001:db8::/129')).toBe(false);
    expect(isValidCidr('1.2.3.0/24/1')).toBe(false);
    expect(inRanges('2a03:2880:f00f::1', ['2a03:2880:f000::/36'])).toBe(true);
    expect(inRanges('2A03:2880:F000:0:0:0:0:1', ['2a03:2880:f000::/36'])).toBe(true);
    expect(inRanges('2a03:2881::1', ['2a03:2880:f000::/36'])).toBe(false);
    expect(inRanges('1.2.3.4', ['2a03:2880:f000::/36', '0.0.0.0/0'])).toBe(true);
    expect(inRanges('::1', ['0.0.0.0/0'])).toBe(false);
  });

  it('parses the operator file format and keeps provenance', () => {
    const parsed = parsePublishedRanges(FILE, 'gptbot', 'gptbot.json', new Date('2026-10-30T10:00:00Z'));
    expect(parsed).toEqual({ family: 'gptbot', cidrs: ['20.15.240.64/28', '2a03:2880:f000::/36'], source: 'gptbot.json', creationTime: '2026-10-01T00:00:00Z', loadedAt: '2026-10-30T10:00:00.000Z' });
    expect(parsePublishedRanges('{', 'gptbot', 'x')).toBe('invalid-json');
    expect(parsePublishedRanges('{"items":[]}', 'gptbot', 'x')).toBe('unsupported-format');
    expect(parsePublishedRanges('{"prefixes":[{"ipv4Prefix":"x"}]}', 'gptbot', 'x')).toBe('no-valid-prefix');
    const many = JSON.stringify({ prefixes: Array.from({ length: 5001 }, (_, i) => ({ ipv4Prefix: `10.${Math.floor(i / 256)}.${i % 256}.0/24` })) });
    expect(parsePublishedRanges(many, 'gptbot', 'x')).toBe('too-many-prefixes');
  });

  it('stores one set per family and verifies a GPTBot claim against it', async () => {
    const ranges = parsePublishedRanges(FILE, 'gptbot', 'gptbot.json');
    if (typeof ranges === 'string') throw new Error(ranges);
    savePublishedRanges('p', ranges);
    expect(savePublishedRanges('p', { ...ranges, source: 'new.json' })?.map((item) => item.source)).toEqual(['new.json']);
    const deps = { ranges: rangesByFamily(readPublishedRanges('p')), now: () => 5 };
    expect(await verifyBot('20.15.240.70', 'GPTBot/1.2', deps)).toEqual({ family: 'gptbot', status: 'verified', method: 'published-ranges', checkedAt: 5 });
    expect((await verifyBot('9.9.9.9', 'GPTBot/1.2', deps)).status).toBe('spoofed');
    expect((await verifyBot('9.9.9.9', 'PerplexityBot', deps)).status).toBe('claimed');
    localStorage.setItem('seomi_project_q_bot_ranges_v1', '[{"family":"x"}]');
    expect(readPublishedRanges('q')).toEqual([]);
  });

  it('records how identities were checked, once per address and family', async () => {
    const state = await importAccessLog({
      fileHash: 'h', verify: { ranges: { gptbot: ['20.15.240.64/28'] }, now: () => 1_700_000_000_000 },
      lines: [line('20.15.240.70', 'GPTBot'), line('20.15.240.70', 'GPTBot'), line('8.8.8.8', 'GPTBot'), line('8.8.8.8', 'Googlebot'), line('7.7.7.7', 'Mozilla')],
    });
    expect(state.verification).toEqual({
      checks: 3, byMethod: { 'reverse-forward-dns': 0, 'published-ranges': 2, none: 1 },
      byStatus: { verified: 1, claimed: 1, spoofed: 1, unknown: 0 }, lastCheckedAt: 1_700_000_000_000,
    });
    saveLogState('p', state);
    expect(readLogState('p').verification).toEqual(state.verification);
  });
});

describe('BotVerificationEvidence', () => {
  it('loads a range file, shows errors and summarizes checks', async () => {
    render(<BotVerificationEvidence projectId="p" summary={{ checks: 2, byMethod: { 'reverse-forward-dns': 1, 'published-ranges': 1, none: 0 }, byStatus: { verified: 1, claimed: 0, spoofed: 1, unknown: 0 }, lastCheckedAt: Date.UTC(2026, 9, 30) }} />);
    expect(screen.getByText(/Identity checks: 2 \(verified 1, claimed 0, spoofed 1\)/)).toBeTruthy();
    const input = screen.getByLabelText('Official IP range file (JSON)');
    fireEvent.change(screen.getByLabelText('Bot'), { target: { value: 'perplexitybot' } });
    fireEvent.change(input, { target: { files: [new File(['{'], 'bad.json')] } });
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('The file is not valid JSON.'));
    fireEvent.change(input, { target: { files: [new File([FILE], 'perplexitybot.json')] } });
    await waitFor(() => expect(screen.getByText(/PerplexityBot: 2 ranges from perplexitybot.json/)).toBeTruthy());
    expect(screen.queryByRole('alert')).toBeNull();
    cleanup();
    render(<BotVerificationEvidence projectId="other" />);
    expect(screen.getByText('No crawler identity has been checked yet.')).toBeTruthy();
  });
});
