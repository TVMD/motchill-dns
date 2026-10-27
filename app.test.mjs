import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

test('minimal page loads each selected list and links Go only after a winner', async () => {
  const original = { document: globalThis.document, window: globalThis.window, fetch: globalThis.fetch };
  try {
    for (const list of ['motchill', 'rophim', null, 'missing']) {
      let finish;
      const complete = new Promise(resolve => { finish = resolve; });
      const status = {
        textContent: '',
        setAttribute(name, value) { if (name === 'aria-busy' && value === 'false') finish(); },
      };
      const result = { hidden: true, textContent: 'Go', removeAttribute() { delete this.href; } };
      globalThis.document = { querySelector: selector => selector === '#status' ? status : result };
      globalThis.window = { location: { search: list === null ? '' : `?list=${list}` } };
      globalThis.fetch = async url => {
        if (url.startsWith('./')) {
          assert.equal(url, `./${list ?? 'hosts'}.txt`);
          assert.equal(result.hidden, true);
          return { ok: list !== 'missing', status: 404, text: async () => 'winner.example' };
        }
        assert.equal(url, 'https://winner.example/');
        return { type: 'opaque' };
      };
      await import(`./app.mjs?test=${list}`);
      await complete;
      assert.equal(result.textContent, 'Go');
      if (list === 'missing') {
        assert.match(status.textContent, /Could not load missing.txt/);
        assert.equal(result.hidden, true);
        assert.equal(result.href, undefined);
      } else {
        assert.equal(status.textContent, 'winner.example');
        assert.equal(result.hidden, false);
        assert.equal(result.href, 'https://winner.example/');
      }
    }
  } finally {
    Object.assign(globalThis, original);
  }
});

test('Pages fallback maps named routes with or without repository prefix and trailing slash', async () => {
  const html = await readFile(new URL('./404.html', import.meta.url), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  for (const prefix of ['', '/repo']) {
    for (const suffix of ['motchill', 'rophim/']) {
      const href = `https://user.github.io${prefix}/${suffix}?old=1#old`;
      let redirected;
      runInNewContext(script, {
        URL, URLSearchParams,
        window: { location: { href, pathname: new URL(href).pathname, replace: value => { redirected = value; } } },
      });
      assert.equal(redirected, `https://user.github.io${prefix}/?list=${suffix.replace('/', '')}`);
    }
  }
  const error = {};
  runInNewContext(script, {
    window: { location: { pathname: '/repo/bad.txt' } },
    document: { querySelector: () => error },
  });
  assert.equal(error.textContent, 'Invalid list name.');
});
