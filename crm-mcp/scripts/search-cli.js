// Quick CLI for manual testing without an MCP client.
// Usage: node scripts/search-cli.js '{"countries":["Єгипет"],"priceMax":40000}'
import { searchTours } from '../src/search.js';
import { compareOperators } from '../src/analytics.js';
import { saveSnapshot } from '../src/store.js';
import { closeSession } from '../src/client.js';

const arg = process.argv[2] || '{}';
let criteria;
try {
  criteria = JSON.parse(arg);
} catch {
  console.error('Pass criteria as a JSON string. Example:');
  console.error(`  node scripts/search-cli.js '{"countries":["Єгипет"],"dateFrom":"2026-07-10","priceMax":45000}'`);
  process.exit(1);
}

const offers = await searchTours(criteria);
saveSnapshot(criteria, offers);
console.log(`\nFound ${offers.length} offers.`);
console.log(JSON.stringify(compareOperators(offers), null, 2));
await closeSession();
