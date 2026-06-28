// Authentication: log in to crm.tat.ua/tf with Playwright and persist the
// session (cookies/localStorage) so subsequent runs reuse it without re-login.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { config } from './config.js';

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function hasStoredState() {
  return fs.existsSync(config.authStatePath);
}

/**
 * Launch a browser context, restoring the saved session if present.
 * Returns { browser, context } — caller is responsible for closing the browser.
 */
export async function launchContext({ headless } = {}) {
  const browser = await chromium.launch({
    headless: headless ?? !config.headful,
  });
  const context = await browser.newContext({
    userAgent: config.userAgent,
    locale: config.lang.replace('_', '-'),
    storageState: hasStoredState() ? config.authStatePath : undefined,
  });
  return { browser, context };
}

async function isLoggedIn(page) {
  // Logged in if a known marker is present and we're not on the login page.
  if (/\/login/i.test(page.url())) return false;
  try {
    await page.waitForSelector(config.selectors.loggedInMarker, {
      timeout: 4000,
    });
    return true;
  } catch {
    // Marker selectors may not be mapped yet; fall back to URL heuristic.
    return !/\/login/i.test(page.url());
  }
}

/**
 * Perform an interactive/automated login and save the session state.
 */
export async function login({ headless } = {}) {
  const { browser, context } = await launchContext({ headless });
  const page = await context.newPage();
  await page.goto(config.loginUrl, { waitUntil: 'domcontentloaded' });

  // Fill credentials. Selectors are best-effort multi-match; refine via recon.
  await page.fill(config.selectors.loginUser, config.login());
  await page.fill(config.selectors.loginPass, config.password());
  await Promise.all([
    page.waitForLoadState('networkidle').catch(() => {}),
    page.click(config.selectors.loginSubmit),
  ]);

  // Give SPA redirects a moment to settle.
  await page.waitForTimeout(2000);

  if (!(await isLoggedIn(page))) {
    const shot = path.join(config.root, 'recon-dumps', 'login-failed.png');
    ensureDir(shot);
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    await browser.close();
    throw new Error(
      `Login appears to have failed. Check credentials and selectors in config.js. ` +
        `Screenshot saved to ${shot}. Try CRM_HEADFUL=true to watch it.`,
    );
  }

  ensureDir(config.authStatePath);
  await context.storageState({ path: config.authStatePath });
  await browser.close();
  return true;
}

/**
 * Ensure we have a usable session. Validates the stored state by hitting the
 * app; re-logs in if the session is missing or expired.
 * Returns { browser, context, page } ready for use (caller closes browser).
 */
export async function ensureSession({ headless } = {}) {
  if (!hasStoredState()) {
    await login({ headless });
  }

  let { browser, context } = await launchContext({ headless });
  let page = await context.newPage();
  await page.goto(config.baseUrl + config.endpoints.searchPage, {
    waitUntil: 'domcontentloaded',
  });

  if (!(await isLoggedIn(page))) {
    // Session expired — re-login and reopen.
    await browser.close();
    await login({ headless });
    ({ browser, context } = await launchContext({ headless }));
    page = await context.newPage();
    await page.goto(config.baseUrl + config.endpoints.searchPage, {
      waitUntil: 'domcontentloaded',
    });
  }

  return { browser, context, page };
}
