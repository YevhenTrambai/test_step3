import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Point the store at a throwaway DB before importing it.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-store-'));
process.env.CRM_DB_PATH = path.join(tmpDir, 'test.sqlite');
process.env.CRM_LOGIN = 'x';
process.env.CRM_PASSWORD = 'y';

let store;
before(async () => {
  store = await import('../src/store.js');
});
after(() => {
  store.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const criteria = { countries: ['Єгипет'], priceMax: 40000 };
const offersV1 = [
  { operator: 'Join UP', country: 'Єгипет', hotel: 'A', stars: 5, departureDate: '2026-07-10', nights: 7, price: 30000, currency: 'UAH', board: 'AI', link: '' },
];
const offersV2 = [
  { operator: 'Join UP', country: 'Єгипет', hotel: 'A', stars: 5, departureDate: '2026-07-10', nights: 7, price: 28000, currency: 'UAH', board: 'AI', link: '' },
];

test('saveSnapshot + getOffers round-trips offers', () => {
  const id = store.saveSnapshot(criteria, offersV1, '2026-06-01T00:00:00Z');
  const back = store.getOffers(id);
  assert.equal(back.length, 1);
  assert.equal(back[0].operator, 'Join UP');
  assert.equal(back[0].price, 30000);
  assert.equal(back[0].departureDate, '2026-07-10');
});

test('listSnapshots and lastTwoSnapshots order newest first', () => {
  store.saveSnapshot(criteria, offersV2, '2026-06-05T00:00:00Z');
  const snaps = store.listSnapshots(criteria);
  assert.equal(snaps.length, 2);
  const [newest, older] = store.lastTwoSnapshots(criteria);
  assert.equal(newest.offers[0].price, 28000);
  assert.equal(older.offers[0].price, 30000);
});

test('criteriaHash is stable regardless of key order', () => {
  const a = store.criteriaHash({ priceMax: 40000, countries: ['Єгипет'] });
  const b = store.criteriaHash({ countries: ['Єгипет'], priceMax: 40000 });
  assert.equal(a, b);
});
