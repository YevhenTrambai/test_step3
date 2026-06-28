// Central configuration for the TAT.ua CRM integration.
//
// Values come from .env (secrets / URLs). The CRM-specific binding — exact API
// endpoints and form selectors — is intentionally isolated HERE so that when the
// SPA changes you only re-run recon (scripts/recon.js) and update this one file,
// never the business logic.
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const abs = (p) => (path.isAbsolute(p) ? p : path.join(root, p));

function required(name) {
  const v = process.env[name];
  if (!v || v.startsWith('your_')) {
    throw new Error(
      `Missing env var ${name}. Copy crm-mcp/.env.example to crm-mcp/.env and fill it in.`,
    );
  }
  return v;
}

export const config = {
  root,
  login: () => required('CRM_LOGIN'),
  password: () => required('CRM_PASSWORD'),

  baseUrl: process.env.CRM_BASE_URL || 'https://crm.tat.ua',
  loginUrl:
    process.env.CRM_LOGIN_URL ||
    'https://crm.tat.ua/tf/login?ref=%2Ftf&lang=uk_UA',
  lang: process.env.CRM_LANG || 'uk_UA',

  authStatePath: abs(process.env.CRM_AUTH_STATE || '.auth/state.json'),
  dbPath: abs(process.env.CRM_DB_PATH || '.data/history.sqlite'),

  headful:
    String(process.env.CRM_HEADFUL || 'false').toLowerCase() === 'true',
  throttleMs: Number(process.env.CRM_THROTTLE_MS || 1200),

  // A realistic UA helps avoid the bot-protection 403 that a raw fetch triggers.
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',

  // ──────────────────────────────────────────────────────────────────────
  // CRM-SPECIFIC BINDING — fill from recon output (scripts/recon.js).
  // Until confirmed, the client runs in "intercept" mode: it drives the real
  // page and harvests whatever JSON the page itself fetches, so it works even
  // before these are pinned down.
  // ──────────────────────────────────────────────────────────────────────
  endpoints: {
    // Mode: 'intercept' (UI-driven, robust default) | 'api' (direct calls).
    mode: process.env.CRM_CLIENT_MODE || 'intercept',

    // The page where the search form lives (relative to baseUrl).
    searchPage: process.env.CRM_SEARCH_PAGE || '/tf',

    // Substring(s) that identify the search RESULTS XHR/fetch response,
    // used by intercept mode to recognize the right network call.
    // Refine these from the recon dump.
    searchResponseMatch: (process.env.CRM_SEARCH_MATCH || 'search,tour,result')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),

    // Direct API (only used when mode === 'api'; discovered via recon):
    searchApi: process.env.CRM_SEARCH_API || null, // e.g. '/tf/api/search'
    referenceApi: process.env.CRM_REFERENCE_API || null,
  },

  // DOM selectors for the search form (intercept mode). Fill from recon.
  // Each is a CSS selector; null means "not yet mapped".
  selectors: {
    loginUser: process.env.CRM_SEL_USER || 'input[name="login"], input[type="email"], input[name="username"]',
    loginPass: process.env.CRM_SEL_PASS || 'input[name="password"], input[type="password"]',
    loginSubmit: process.env.CRM_SEL_SUBMIT || 'button[type="submit"], input[type="submit"]',
    // After login these confirm we are authenticated (any one present = logged in).
    loggedInMarker: process.env.CRM_SEL_LOGGED_IN || '[href*="logout"], .user-menu, .profile',
  },
};

export default config;
