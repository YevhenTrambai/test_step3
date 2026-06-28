// Reference data (countries, tour operators, departure cities, board types).
// Needed to map human-readable search criteria ("Єгипет", "Join UP") to the
// IDs the CRM expects. Cached to disk to avoid refetching on every call.
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { apiRequest } from './client.js';

const cacheFile = path.join(config.root, '.data', 'reference-cache.json');
const TTL_MS = 24 * 60 * 60 * 1000; // 1 day

function readCache() {
  try {
    const raw = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    if (Date.now() - raw._fetchedAt < TTL_MS) return raw.data;
  } catch {
    /* no cache */
  }
  return null;
}

function writeCache(data) {
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify({ _fetchedAt: Date.now(), data }, null, 2));
}

/**
 * Fetch reference dictionaries. Uses the discovered reference API when set;
 * otherwise returns an empty skeleton so callers degrade gracefully until recon
 * pins the endpoint down.
 */
export async function loadReference({ force = false } = {}) {
  if (!force) {
    const cached = readCache();
    if (cached) return cached;
  }

  const data = { countries: [], operators: [], departureCities: [], boards: [] };

  if (config.endpoints.referenceApi) {
    try {
      const raw = await apiRequest(config.endpoints.referenceApi);
      // Defensive mapping — adjust keys to the real schema after recon.
      data.countries = normalizeList(raw.countries || raw.country || []);
      data.operators = normalizeList(raw.operators || raw.tourOperators || []);
      data.departureCities = normalizeList(raw.departureCities || raw.cities || []);
      data.boards = normalizeList(raw.boards || raw.meals || []);
    } catch (err) {
      data._error = `reference fetch failed: ${err.message}`;
    }
  } else {
    data._note =
      'CRM_REFERENCE_API not configured. Run recon to find the dictionary endpoint, ' +
      'then set it in .env to enable name->id mapping.';
  }

  writeCache(data);
  return data;
}

// Normalize {id,name} from various shapes ([{id,title}], {id:name} map, …).
function normalizeList(input) {
  if (Array.isArray(input)) {
    return input.map((it) => ({
      id: it.id ?? it.value ?? it.code ?? it.key,
      name: it.name ?? it.title ?? it.label ?? it.text ?? String(it),
    }));
  }
  if (input && typeof input === 'object') {
    return Object.entries(input).map(([id, name]) => ({ id, name: String(name) }));
  }
  return [];
}

/** Resolve a list of human names to IDs using the reference dictionary. */
export function resolveNames(names, dict) {
  if (!names || !names.length) return [];
  const norm = (s) => String(s).trim().toLowerCase();
  const byName = new Map(dict.map((d) => [norm(d.name), d.id]));
  return names.map((n) => {
    const hit = byName.get(norm(n));
    if (hit != null) return hit;
    // Loose contains match as a fallback.
    const partial = dict.find((d) => norm(d.name).includes(norm(n)));
    return partial ? partial.id : n; // fall back to raw value
  });
}
