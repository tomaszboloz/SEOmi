import assert from 'node:assert/strict';
import test from 'node:test';
import { isPublicAddress, parseIpv4, parseIpv6Words } from '../dist/ipSafety.js';

test('public IPv4 parser accepts exact octets and rejects alternate or malformed spellings', () => {
  assert.deepEqual(parseIpv4('8.8.4.4'), [8, 8, 4, 4]);
  assert.deepEqual(parseIpv4('0.255.128.1'), [0, 255, 128, 1]);
  for (const value of ['', '256.1.1.1', '01.2.3.4', '127.1', '0x7f000001', '2130706433', '::1', '1.2.3.x']) {
    assert.equal(parseIpv4(value), null, value);
  }
});

test('public IPv6 parser expands compressed and mapped values without accepting invalid words', () => {
  assert.deepEqual(parseIpv6Words('2001:4860:4860::8888'), [0x2001, 0x4860, 0x4860, 0, 0, 0, 0, 0x8888]);
  assert.deepEqual(parseIpv6Words('::FFFF:8.8.4.4'), [0, 0, 0, 0, 0, 0xffff, 0x0808, 0x0404]);
  assert.deepEqual(parseIpv6Words('::'), Array(8).fill(0));
  assert.deepEqual(parseIpv6Words('1:2:3:4:5:6:7:8'), [1, 2, 3, 4, 5, 6, 7, 8]);
  for (const value of ['', '1:2', '1::2::3', '1:2:3:4:5:6:7:8:9', '1:2:3:4:5:6:7::8', 'gggg::1', '12345::1', '::ffff:999.1.1.1']) {
    assert.equal(parseIpv6Words(value), null, value);
  }
});

test('public-address policy rejects every private/documentation/multicast family and mapped equivalent', () => {
  for (const value of [
    '0.1.2.3', '10.0.0.1', '127.0.0.1', '224.0.0.1', '255.255.255.255',
    '100.64.0.1', '100.127.255.255', '169.254.1.1', '172.16.0.1', '172.31.255.255',
    '192.168.1.1', '192.0.0.1', '192.0.2.1', '192.88.99.1', '198.18.0.1',
    '198.19.0.1', '198.51.100.1', '203.0.113.1', '::1', '::', 'fc00::1', 'fe80::1',
    'ff02::1', '2001:db8::1', '2001:100::1', '2002:0808:0808::1',
    '::ffff:127.0.0.1', '::ffff:10.0.0.1', 'invalid',
  ]) assert.equal(isPublicAddress(value), false, value);
  for (const value of [
    '8.8.8.8', '1.1.1.1', '100.63.255.255', '100.128.0.1', '172.15.255.255',
    '172.32.0.1', '2001:4860:4860::8888', '2606:4700:4700::1111', '::ffff:8.8.4.4',
  ]) assert.equal(isPublicAddress(value), true, value);
});
