// Parametrized tour search. Accepts human-friendly criteria, runs the search
// through whichever client mode is configured, and returns a normalized list of
// offers shaped for analytics and display.
import { config } from './config.js';
import { apiRequest, interceptSearch } from './client.js';
import { loadReference, resolveNames } from './reference.js';

/**
 * @typedef {Object} SearchCriteria
 * @property {string[]} [countries]   country names or ids
 * @property {string}   [dateFrom]    YYYY-MM-DD (earliest departure)
 * @property {string}   [dateTo]      YYYY-MM-DD (latest departure)
 * @property {number}   [priceMin]
 * @property {number}   [priceMax]
 * @property {string[]} [operators]   operator names or ids
 * @property {number}   [nights]
 * @property {number}   [nightsTo]
 * @property {number}   [adults]
 * @property {number}   [children]
 * @property {string[]} [boards]      meal types
 * @property {number}   [stars]       minimum hotel stars
 * @property {string}   [departure]   departure city
 */

/**
 * @typedef {Object} Offer
 * @property {string} operator
 * @property {string} country
 * @property {string} hotel
 * @property {number} stars
 * @property {string} departureDate  YYYY-MM-DD
 * @property {number} nights
 * @property {number} price
 * @property {string} currency
 * @property {string} board
 * @property {string} link
 */

/** Run a search and return normalized offers. */
export async function searchTours(criteria = {}) {
  const dict = await loadReference().catch(() => ({ countries: [], operators: [] }));
  const countryIds = resolveNames(criteria.countries, dict.countries || []);
  const operatorIds = resolveNames(criteria.operators, dict.operators || []);

  let raw;
  if (config.endpoints.mode === 'api' && config.endpoints.searchApi) {
    raw = await searchViaApi(criteria, countryIds, operatorIds);
  } else {
    raw = await searchViaIntercept(criteria, countryIds, operatorIds);
  }

  const offers = normalizeOffers(raw);
  return applyClientSideFilters(offers, criteria);
}

// ── API mode ──────────────────────────────────────────────────────────────
async function searchViaApi(criteria, countryIds, operatorIds) {
  // Param names below are best-effort; correct them from recon output.
  const params = pruneUndefined({
    countries: countryIds.join(',') || undefined,
    operators: operatorIds.join(',') || undefined,
    dateFrom: criteria.dateFrom,
    dateTo: criteria.dateTo,
    priceFrom: criteria.priceMin,
    priceTo: criteria.priceMax,
    nightsFrom: criteria.nights,
    nightsTo: criteria.nightsTo ?? criteria.nights,
    adults: criteria.adults ?? 2,
    children: criteria.children ?? 0,
    departure: criteria.departure,
    stars: criteria.stars,
  });
  return apiRequest(config.endpoints.searchApi, { params });
}

// ── Intercept mode (robust default) ─────────────────────────────────────────
async function searchViaIntercept(criteria) {
  const sel = config.selectors;
  return interceptSearch(async (page) => {
    // Best-effort form fill. Selectors that aren't mapped are skipped silently,
    // so partial mapping still yields whatever the page returns.
    await fillIfPresent(page, sel.country, criteria.countries?.[0]);
    await fillIfPresent(page, sel.dateFrom, criteria.dateFrom);
    await fillIfPresent(page, sel.dateTo, criteria.dateTo);
    await fillIfPresent(page, sel.priceMin, criteria.priceMin);
    await fillIfPresent(page, sel.priceMax, criteria.priceMax);
    if (sel.searchButton) {
      await page.click(sel.searchButton).catch(() => {});
    }
  });
}

async function fillIfPresent(page, selector, value) {
  if (!selector || value == null) return;
  try {
    await page.fill(selector, String(value), { timeout: 2000 });
  } catch {
    /* selector not present / not yet mapped */
  }
}

// ── Normalization ───────────────────────────────────────────────────────────
// Defensive: probes common field names across possible response shapes. Replace
// with an exact mapper once the recon dump shows the real schema.
export function normalizeOffers(raw) {
  const list = extractOfferArray(raw);
  return list.map((o) => ({
    operator: pick(o, ['operator', 'operatorName', 'tourOperator', 'to']) ?? 'unknown',
    country: pick(o, ['country', 'countryName', 'countryTitle']) ?? '',
    hotel: pick(o, ['hotel', 'hotelName', 'hotelTitle', 'name']) ?? '',
    stars: num(pick(o, ['stars', 'hotelStars', 'category'])) ?? 0,
    departureDate: pick(o, ['departureDate', 'dateFrom', 'date', 'startDate']) ?? '',
    nights: num(pick(o, ['nights', 'nightCount', 'days'])) ?? 0,
    price: num(pick(o, ['price', 'priceUah', 'cost', 'amount', 'total'])) ?? 0,
    currency: pick(o, ['currency', 'priceCurrency']) ?? 'UAH',
    board: pick(o, ['board', 'meal', 'mealType', 'pansion']) ?? '',
    link: pick(o, ['link', 'url', 'href']) ?? '',
  }));
}

function extractOfferArray(raw) {
  const sources = Array.isArray(raw) ? raw : [raw];
  for (const r of sources) {
    if (Array.isArray(r)) return r;
    if (r && typeof r === 'object') {
      for (const key of ['offers', 'results', 'tours', 'items', 'data', 'hotels']) {
        if (Array.isArray(r[key])) return r[key];
      }
    }
  }
  return [];
}

// ── Client-side filtering (guarantees criteria are honored even if the upstream
// search ignores some params) ───────────────────────────────────────────────
function applyClientSideFilters(offers, c) {
  return offers.filter((o) => {
    if (c.priceMin != null && o.price && o.price < c.priceMin) return false;
    if (c.priceMax != null && o.price && o.price > c.priceMax) return false;
    if (c.nights != null && o.nights && o.nights < c.nights) return false;
    if (c.nightsTo != null && o.nights && o.nights > c.nightsTo) return false;
    if (c.stars != null && o.stars && o.stars < c.stars) return false;
    if (c.dateFrom && o.departureDate && o.departureDate < c.dateFrom) return false;
    if (c.dateTo && o.departureDate && o.departureDate > c.dateTo) return false;
    return true;
  });
}

// ── helpers ─────────────────────────────────────────────────────────────────
function pick(obj, keys) {
  for (const k of keys) if (obj && obj[k] != null && obj[k] !== '') return obj[k];
  return undefined;
}
function num(v) {
  if (v == null) return undefined;
  const n = Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}
function pruneUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}
