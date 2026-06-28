// RECON — the key discovery step (Этап 0 of the plan).
//
// Logs in, opens the search page, and records EVERY XHR/fetch the SPA makes.
// You then perform a search in the opened browser (run with CRM_HEADFUL=true),
// and this script dumps all captured network calls + responses so we can pin
// down the real search/reference endpoints, their params, and response schema.
//
// Usage:
//   cd crm-mcp && cp .env.example .env   # fill in CRM_LOGIN / CRM_PASSWORD
//   CRM_HEADFUL=true npm run recon
//   -> a browser opens; log in if needed, run a tour search, then return to the
//      terminal and press ENTER. Dumps land in crm-mcp/recon-dumps/.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { config } from '../src/config.js';
import { ensureSession } from '../src/auth.js';

const outDir = path.join(config.root, 'recon-dumps');
fs.mkdirSync(outDir, { recursive: true });

const STATIC = /\.(png|jpe?g|gif|svg|webp|css|woff2?|ttf|ico|map)(\?|$)/i;
const captured = [];

function waitForEnter(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(prompt, () => { rl.close(); resolve(); }));
}

async function main() {
  console.log('Opening CRM with a persisted session…');
  const { browser, context, page } = await ensureSession({ headless: false });

  context.on('response', async (response) => {
    const req = response.request();
    const url = response.url();
    if (STATIC.test(url)) return;
    if (req.resourceType() === 'document' && url.includes('/login')) return;

    const entry = {
      method: req.method(),
      url,
      status: response.status(),
      resourceType: req.resourceType(),
      requestPostData: req.postData() || null,
      requestHeaders: req.headers(),
      contentType: response.headers()['content-type'] || '',
    };

    // Capture JSON bodies (these are the API calls we care about).
    if (/json/i.test(entry.contentType)) {
      try {
        entry.responseBody = await response.json();
      } catch {
        entry.responseBody = '<unparseable json>';
      }
    }
    captured.push(entry);
  });

  console.log('\nA browser window is open with your CRM session.');
  console.log('1) If not logged in, log in.');
  console.log('2) Run a tour search (pick country, dates, etc.).');
  console.log('3) Come back here and press ENTER to dump captured traffic.\n');
  await waitForEnter('Press ENTER when done… ');

  // Persist full dump and a focused "likely API" view.
  const full = path.join(outDir, 'network-full.json');
  fs.writeFileSync(full, JSON.stringify(captured, null, 2));

  const apiLike = captured.filter(
    (e) => /json/i.test(e.contentType) && (e.method !== 'GET' || /api|search|tour|country|operator/i.test(e.url)),
  );
  const summary = apiLike.map((e) => ({
    method: e.method,
    url: e.url,
    status: e.status,
    requestPostData: e.requestPostData,
    responseSample: sample(e.responseBody),
  }));
  fs.writeFileSync(path.join(outDir, 'api-candidates.json'), JSON.stringify(summary, null, 2));

  console.log(`\nCaptured ${captured.length} responses (${apiLike.length} JSON/API-like).`);
  console.log(`Full dump:        ${full}`);
  console.log(`API candidates:   ${path.join(outDir, 'api-candidates.json')}`);
  console.log('\nNext: inspect api-candidates.json, then set CRM_SEARCH_API / selectors in .env (or config.js).');

  await browser.close();
}

// Shallow sample of a (possibly huge) JSON body for readability.
function sample(body, depth = 0) {
  if (body == null || typeof body !== 'object') return body;
  if (Array.isArray(body)) {
    return { _array_len: body.length, _first: depth < 2 ? sample(body[0], depth + 1) : '…' };
  }
  const out = {};
  for (const k of Object.keys(body).slice(0, 25)) {
    out[k] = depth < 2 ? sample(body[k], depth + 1) : '…';
  }
  return out;
}

main().catch((err) => {
  console.error('Recon failed:', err.message);
  process.exit(1);
});
