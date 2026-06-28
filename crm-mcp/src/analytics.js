// Extended analytics over normalized offers. Pure functions (no I/O) so they are
// easy to unit-test; the time-series helpers take snapshots loaded from store.js.

function prices(offers) {
  return offers.map((o) => Number(o.price)).filter((p) => Number.isFinite(p) && p > 0);
}

function stats(arr) {
  if (!arr.length) return { count: 0, min: null, max: null, avg: null, median: null };
  const sorted = [...arr].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return {
    count: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: Math.round((sum / sorted.length) * 100) / 100,
    median,
  };
}

/** Compare offers grouped by tour operator: count, price stats, best offer. */
export function compareOperators(offers) {
  const groups = new Map();
  for (const o of offers) {
    const key = o.operator || 'unknown';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  }
  const rows = [...groups.entries()].map(([operator, list]) => {
    const s = stats(prices(list));
    const best = list
      .filter((o) => o.price > 0)
      .sort((a, b) => a.price - b.price)[0] || null;
    return { operator, offers: list.length, ...s, bestOffer: best };
  });
  rows.sort((a, b) => (a.min ?? Infinity) - (b.min ?? Infinity));
  return { overall: stats(prices(offers)), byOperator: rows };
}

/** Price distribution across departure dates within a single result set. */
export function priceDynamicsByDate(offers) {
  const byDate = new Map();
  for (const o of offers) {
    const d = o.departureDate || 'unknown';
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d).push(o);
  }
  const series = [...byDate.entries()]
    .map(([date, list]) => ({ date, ...stats(prices(list)) }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return series;
}

/** Trend of the minimum price across historical snapshots (oldest -> newest). */
export function priceTrend(snapshots) {
  const points = snapshots
    .map((s) => ({ at: s.created_at, ...stats(prices(s.offers || [])) }))
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));
  let change = null;
  if (points.length >= 2) {
    const first = points[0].min;
    const last = points[points.length - 1].min;
    if (first != null && last != null) {
      change = {
        from: first,
        to: last,
        deltaAbs: Math.round((last - first) * 100) / 100,
        deltaPct: first ? Math.round(((last - first) / first) * 10000) / 100 : null,
      };
    }
  }
  return { points, change };
}

/**
 * Diff two snapshots' offers (previous vs current) to surface what changed.
 * Identity = operator|hotel|departureDate|nights.
 */
export function monitorDiff(previousOffers = [], currentOffers = []) {
  const key = (o) => [o.operator, o.hotel, o.departureDate, o.nights].join('|');
  const prev = new Map(previousOffers.map((o) => [key(o), o]));
  const curr = new Map(currentOffers.map((o) => [key(o), o]));

  const added = [];
  const removed = [];
  const cheaper = [];
  const pricier = [];

  for (const [k, o] of curr) {
    if (!prev.has(k)) {
      added.push(o);
    } else {
      const before = prev.get(k);
      if (o.price && before.price && o.price !== before.price) {
        const entry = { ...o, previousPrice: before.price, delta: Math.round((o.price - before.price) * 100) / 100 };
        (o.price < before.price ? cheaper : pricier).push(entry);
      }
    }
  }
  for (const [k, o] of prev) if (!curr.has(k)) removed.push(o);

  return {
    summary: {
      added: added.length,
      removed: removed.length,
      cheaper: cheaper.length,
      pricier: pricier.length,
    },
    added,
    removed,
    cheaper: cheaper.sort((a, b) => a.delta - b.delta),
    pricier: pricier.sort((a, b) => b.delta - a.delta),
  };
}

export { stats };
