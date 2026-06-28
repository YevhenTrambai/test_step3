import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compareOperators,
  priceDynamicsByDate,
  priceTrend,
  monitorDiff,
  stats,
} from '../src/analytics.js';

const offers = [
  { operator: 'Join UP', country: 'Єгипет', hotel: 'A', stars: 5, departureDate: '2026-07-10', nights: 7, price: 30000, currency: 'UAH', board: 'AI' },
  { operator: 'Join UP', country: 'Єгипет', hotel: 'B', stars: 4, departureDate: '2026-07-12', nights: 7, price: 36000, currency: 'UAH', board: 'AI' },
  { operator: 'Coral', country: 'Єгипет', hotel: 'C', stars: 5, departureDate: '2026-07-10', nights: 7, price: 28000, currency: 'UAH', board: 'AI' },
  { operator: 'Coral', country: 'Єгипет', hotel: 'D', stars: 3, departureDate: '2026-07-12', nights: 7, price: 41000, currency: 'UAH', board: 'BB' },
];

test('stats computes min/max/avg/median', () => {
  const s = stats([10, 20, 30, 40]);
  assert.equal(s.min, 10);
  assert.equal(s.max, 40);
  assert.equal(s.avg, 25);
  assert.equal(s.median, 25);
  assert.equal(s.count, 4);
});

test('compareOperators groups and ranks by min price', () => {
  const r = compareOperators(offers);
  assert.equal(r.byOperator.length, 2);
  // Coral has the lowest min (28000) -> ranked first.
  assert.equal(r.byOperator[0].operator, 'Coral');
  assert.equal(r.byOperator[0].min, 28000);
  assert.equal(r.byOperator[0].bestOffer.hotel, 'C');
  assert.equal(r.overall.min, 28000);
  assert.equal(r.overall.max, 41000);
});

test('priceDynamicsByDate buckets by departure date', () => {
  const series = priceDynamicsByDate(offers);
  assert.equal(series.length, 2);
  assert.equal(series[0].date, '2026-07-10');
  assert.equal(series[0].min, 28000); // min of 30000 & 28000
  assert.equal(series[1].date, '2026-07-12');
  assert.equal(series[1].min, 36000);
});

test('priceTrend computes change between oldest and newest snapshot', () => {
  const snaps = [
    { created_at: '2026-06-01T00:00:00Z', offers: [{ price: 40000 }] },
    { created_at: '2026-06-10T00:00:00Z', offers: [{ price: 30000 }] },
  ];
  const t = priceTrend(snaps);
  assert.equal(t.points.length, 2);
  assert.equal(t.change.from, 40000);
  assert.equal(t.change.to, 30000);
  assert.equal(t.change.deltaAbs, -10000);
  assert.equal(t.change.deltaPct, -25);
});

test('monitorDiff detects added, removed, cheaper, pricier', () => {
  const prev = [
    { operator: 'Join UP', hotel: 'A', departureDate: '2026-07-10', nights: 7, price: 30000 },
    { operator: 'Coral', hotel: 'C', departureDate: '2026-07-10', nights: 7, price: 28000 },
    { operator: 'Old', hotel: 'X', departureDate: '2026-07-10', nights: 7, price: 50000 },
  ];
  const curr = [
    { operator: 'Join UP', hotel: 'A', departureDate: '2026-07-10', nights: 7, price: 27000 }, // cheaper
    { operator: 'Coral', hotel: 'C', departureDate: '2026-07-10', nights: 7, price: 31000 }, // pricier
    { operator: 'New', hotel: 'Z', departureDate: '2026-07-10', nights: 7, price: 22000 }, // added
  ];
  const d = monitorDiff(prev, curr);
  assert.equal(d.summary.added, 1);
  assert.equal(d.summary.removed, 1);
  assert.equal(d.summary.cheaper, 1);
  assert.equal(d.summary.pricier, 1);
  assert.equal(d.added[0].operator, 'New');
  assert.equal(d.removed[0].operator, 'Old');
  assert.equal(d.cheaper[0].delta, -3000);
  assert.equal(d.pricier[0].delta, 3000);
});
