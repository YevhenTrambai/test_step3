// Low-level CRM client. Owns the authenticated session and exposes two ways to
// pull data, both isolated from the business logic above:
//
//   • api mode      — direct JSON calls to discovered endpoints (fast, clean).
//   • intercept mode — drive the real SPA and harvest the JSON it fetches
//                      (robust default; works even before endpoints are pinned).
//
// Which one is used is decided by config.endpoints.mode.
import { config } from './config.js';
import { ensureSession } from './auth.js';

let _session = null; // { browser, context, page }
let _lastRequestAt = 0;

async function throttle() {
  const wait = config.throttleMs - (Date.now() - _lastRequestAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  _lastRequestAt = Date.now();
}

export async function getSession() {
  if (!_session) _session = await ensureSession({ headless: !config.headful });
  return _session;
}

export async function closeSession() {
  if (_session) {
    await _session.browser.close().catch(() => {});
    _session = null;
  }
}

function matchesSearchResponse(url) {
  return config.endpoints.searchResponseMatch.some((m) => url.includes(m));
}

/**
 * Direct authenticated JSON request (api mode). `pathOrUrl` may be relative.
 */
export async function apiRequest(pathOrUrl, { method = 'GET', data, params } = {}) {
  await throttle();
  const { context } = await getSession();
  let url = pathOrUrl.startsWith('http') ? pathOrUrl : config.baseUrl + pathOrUrl;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    url += (url.includes('?') ? '&' : '?') + qs;
  }
  const res = await context.request.fetch(url, {
    method,
    data,
    headers: { accept: 'application/json' },
  });
  if (!res.ok()) {
    throw new Error(`API ${method} ${url} -> HTTP ${res.status()}`);
  }
  return res.json();
}

/**
 * Intercept mode: open the search page, run `trigger` (which fills/submits the
 * form), and collect every JSON response whose URL matches the search filter.
 * Returns an array of parsed JSON payloads (raw, un-normalized).
 *
 * @param {(page) => Promise<void>} trigger  performs the search interaction
 */
export async function interceptSearch(trigger) {
  await throttle();
  const { page } = await getSession();
  const collected = [];

  const handler = async (response) => {
    const url = response.url();
    if (!matchesSearchResponse(url)) return;
    if (!/json/i.test(response.headers()['content-type'] || '')) return;
    try {
      collected.push(await response.json());
    } catch {
      /* ignore unparseable */
    }
  };

  page.on('response', handler);
  try {
    await page.goto(config.baseUrl + config.endpoints.searchPage, {
      waitUntil: 'domcontentloaded',
    });
    await trigger(page);
    // Allow async result XHRs to land.
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1500);
  } finally {
    page.off('response', handler);
  }
  return collected;
}
