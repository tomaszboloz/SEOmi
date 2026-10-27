import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { isPublicAddress, requestPinnedPublicTarget, validatePublicTarget } from '../dist/httpSafety.js';
import { pinnedLookup } from '../dist/pinnedLookup.js';

test('validatePublicTarget keeps the whole verified address list, first address stays primary', async () => {
  const target = await validatePublicTarget('https://dual.example/', async () => [
    { address: '2606:4700:4700::1111', family: 6 },
    { address: '8.8.8.8', family: 4 },
  ]);
  assert.equal(target.address, '2606:4700:4700::1111');
  assert.deepEqual(target.addresses, [
    { address: '2606:4700:4700::1111', family: 6 },
    { address: '8.8.8.8', family: 4 },
  ]);
  await assert.rejects(validatePublicTarget('https://bad.example/', async () => [{ address: 'nope', family: 4 }]), /special-purpose/);
});

test('pinned lookup answers only with verified addresses, in single and all mode', () => {
  const list = [{ address: '2606:4700:4700::1111', family: 6 }, { address: '8.8.8.8', family: 4 }];
  const lookup = pinnedLookup(list);
  let all; let single;
  lookup('ignored.example', { all: true }, (...args) => { all = args; });
  lookup('ignored.example', undefined, (...args) => { single = args; });
  assert.deepEqual(all, [null, list]);
  assert.deepEqual(single, [null, '2606:4700:4700::1111', 6]);
});

test('request falls back to IPv4 when the first verified IPv6 address is unreachable', async (t) => {
  const server = createServer((_request, response) => response.end('via-ipv4'));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const target = {
    url: new URL(`http://fallback.invalid:${port}/`),
    address: '::1',
    family: 6,
    addresses: [{ address: '::1', family: 6 }, { address: '127.0.0.1', family: 4 }],
  };
  const response = await requestPinnedPublicTarget(target, 3_000);
  assert.equal(await response.text(), 'via-ipv4');
});

test('IPv6 special-purpose prefixes are not public', () => {
  for (const value of [
    '64:ff9b::808:808', '64:ff9b::1', '64:ff9b:1::1', '64:ff9b:1:ffff::1', '2620:4f:8000::1', '2620:4f:8000:ffff::1',
    '3fff::1', '3fff:fff:ffff::1', '100::1', '2001:2::1', '2001:10::1', '2001:20::1', '2001:db8::1', '2002::1', 'fec0::1',
  ]) assert.equal(isPublicAddress(value), false, value);
  for (const value of ['2620:4e::1', '2620:4f:8001::1', '2620:50::1', '3fff:1000::1', '2606:4700:4700::1111', '2001:4860:4860::8888'])
    assert.equal(isPublicAddress(value), true, value);
});
