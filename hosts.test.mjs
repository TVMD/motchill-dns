import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHosts, firstRespondingHost, loadHosts } from './hosts.mjs';

test('parses comments, CRLF, case and duplicate hostnames', () => {
  assert.deepEqual(parseHosts('# mirrors\r\n A.example \r\na.example\n\nb.example'), ['a.example', 'b.example']);
});

test('accepts HTTPS URLs and deduplicates their extracted hostnames', () => {
  assert.deepEqual(parseHosts('https://motchillt.cx/\nMOTCHILLT.CX\nhttps://Other.example/watch?id=1#top'), ['motchillt.cx', 'other.example']);
});

test('rejects empty and malformed lists before making requests', () => {
  for (const value of ['', '# empty', 'https://', 'http://a.example', 'javascript:alert(1)', 'https://user:secret@a.example/', 'https://a.example:8443/', 'a.example/path', 'a.example:443', '-a.example', 'a..example', 'a.example?x']) {
    assert.throws(() => parseHosts(value));
  }
});

test('loads hosts relative to the page and reports file errors', async () => {
  assert.deepEqual(await loadHosts(async (url) => {
    assert.equal(url, './hosts.txt');
    return { ok: true, text: async () => 'a.example' };
  }), ['a.example']);
  await assert.rejects(loadHosts(async () => ({ ok: false, status: 404 })), /404/);
  await assert.rejects(loadHosts(async () => { throw new Error('offline'); }), /offline/);
});

test('loads named lists and rejects unsafe list names before fetching', async () => {
  for (const name of ['motchill', 'rophim', 'other-list_2']) {
    assert.deepEqual(await loadHosts(async url => {
      assert.equal(url, `./${name}.txt`);
      return { ok: true, text: async () => 'a.example' };
    }, name), ['a.example']);
  }
  for (const name of ['', '../secret', '/motchill', 'a.txt', 'a?x', 'https://evil.example']) {
    await assert.rejects(loadHosts(() => assert.fail('must not fetch'), name), /Invalid list name/);
  }
  await assert.rejects(loadHosts(async () => ({ ok: false, status: 404 }), 'rophim'), /rophim.txt/);
});

test('checks one at a time in file order and stops at the first response', async () => {
  const requests = [];
  const fetcher = (url, options) => new Promise((resolve, reject) => {
    requests.push({ url, options, resolve, reject });
  });
  const result = firstRespondingHost(['a.example', 'b.example', 'c.example'], { fetcher });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://a.example/');
  requests[0].reject(new Error('offline'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests.length, 2);
  assert.equal(requests[1].url, 'https://b.example/');
  assert.equal(requests[0].options.signal.aborted, true);
  requests[1].resolve({ type: 'opaque', status: 0 });
  assert.equal(await result, 'b.example');
  assert.equal(requests.length, 2);
  assert.ok(requests.every(({ options }) => options.signal.aborted));
  assert.equal(requests[1].options.credentials, 'omit');
  assert.equal(requests[1].options.mode, 'no-cors');
});

test('a responding first entry prevents all later checks', async () => {
  const calls = [];
  const winner = await firstRespondingHost(['a.example', 'b.example'], {
    fetcher: async url => { calls.push(url); return { type: 'opaque' }; },
  });
  assert.equal(winner, 'a.example');
  assert.deepEqual(calls, ['https://a.example/']);
});

test('skips HTTP errors when the browser exposes status', async () => {
  const winner = await firstRespondingHost(['a.example', 'b.example'], {
    fetcher: async url => ({ type: 'basic', ok: url.includes('b.example') }),
  });
  assert.equal(winner, 'b.example');
});

test('reports all failed and empty lists', async () => {
  await assert.rejects(firstRespondingHost(['a.example'], { fetcher: async () => { throw new Error('offline'); } }), /No host responded/);
  await assert.rejects(firstRespondingHost([]), /No hostnames/);
});

test('times out a hanging host before trying the next host', async () => {
  const requests = [];
  assert.equal(await firstRespondingHost(['a.example', 'b.example'], {
    timeoutMs: 5,
    fetcher: (url, options) => {
      requests.push({ url, signal: options.signal });
      if (url.includes('a.example')) return new Promise(() => {});
      assert.equal(requests[0].signal.aborted, true);
      return Promise.resolve({ type: 'opaque' });
    },
  }), 'b.example');
  assert.equal(requests.length, 2);
  assert.notEqual(requests[0].signal, requests[1].signal);
  await assert.rejects(firstRespondingHost(['a.example'], {
    timeoutMs: 5, fetcher: () => new Promise(() => {}),
  }), /No host responded/);
});
