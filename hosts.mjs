export function parseHosts(text) {
  const hosts = text.split(/\r?\n/).map(line => line.trim().toLowerCase())
    .filter(line => line && !line.startsWith('#')).map(entry => {
      if (!entry.startsWith('https://')) return entry;
      let url;
      try {
        url = new URL(entry);
      } catch {
        throw new Error('Invalid HTTPS URL in the selected list.');
      }
      if (url.username || url.password || url.port) {
        throw new Error('HTTPS URLs must not include credentials or a custom port.');
      }
      return url.hostname;
    });
  if (!hosts.length) throw new Error('No hostnames in the selected list.');
  for (const host of hosts) {
    const labels = host.split('.');
    if (host.length > 253 || labels.length < 2 || !labels.every(label =>
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
      throw new Error('Invalid hostname. Use a hostname or an HTTPS URL without credentials or a custom port.');
    }
  }
  return [...new Set(hosts)];
}

export async function loadHosts(fetcher = fetch, list = 'hosts') {
  if (!/^[a-zA-Z0-9_-]+$/.test(list)) throw new Error('Invalid list name.');
  const response = await fetcher(`./${list}.txt`, {
    cache: 'no-store', signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Could not load ${list}.txt (HTTP ${response.status}).`);
  return parseHosts(await response.text());
}

export async function firstRespondingHost(hosts, { fetcher = fetch, timeoutMs = 8000 } = {}) {
  if (!hosts.length) throw new Error('No hostnames to check.');
  for (const host of hosts) {
    const controller = new AbortController();
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Host check timed out.')), timeoutMs);
    });
    try {
      const response = await Promise.race([fetcher(`https://${host}/`, {
        mode: 'no-cors', credentials: 'omit', cache: 'no-store',
        referrerPolicy: 'no-referrer', signal: controller.signal,
      }), deadline]);
      // shortcut: opaque responses hide HTTP errors; use a CORS health endpoint if health checks are needed.
      if (response.type === 'opaque' || response.ok) return host;
    } catch {
      // A failed or timed-out host must not prevent checking the next entry.
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  }
  throw new Error('No host responded.');
}
