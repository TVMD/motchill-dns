import { loadHosts, firstRespondingHost } from './hosts.mjs';

const status = document.querySelector('#status');
const result = document.querySelector('#result');

async function checkHosts() {
  result.hidden = true;
  result.removeAttribute('href');
  status.textContent = '';
  status.setAttribute('aria-busy', 'true');
  try {
    const list = new URLSearchParams(window.location.search).get('list') ?? 'hosts';
    const hosts = await loadHosts(fetch, list);
    const hostname = await firstRespondingHost(hosts);
    status.textContent = hostname;
    result.href = `https://${hostname}/`;
    result.hidden = false;
  } catch (error) {
    status.textContent = `Check failed: ${error.message}`;
  } finally {
    status.setAttribute('aria-busy', 'false');
  }
}

checkHosts();
