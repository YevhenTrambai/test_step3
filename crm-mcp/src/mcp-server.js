// MCP stdio server exposing the CRM as callable tools. Claude (or any MCP
// client) calls these with search criteria and gets results + analytics back.
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { searchTours } from './search.js';
import { loadReference } from './reference.js';
import { closeSession } from './client.js';
import {
  compareOperators,
  priceDynamicsByDate,
  priceTrend,
  monitorDiff,
} from './analytics.js';
import { saveSnapshot, listSnapshots, getOffers, lastTwoSnapshots } from './store.js';

const criteriaProps = {
  countries: { type: 'array', items: { type: 'string' }, description: 'Country names or ids, e.g. ["Єгипет","Туреччина"]' },
  operators: { type: 'array', items: { type: 'string' }, description: 'Tour operator names or ids' },
  dateFrom: { type: 'string', description: 'Earliest departure date, YYYY-MM-DD' },
  dateTo: { type: 'string', description: 'Latest departure date, YYYY-MM-DD' },
  priceMin: { type: 'number' },
  priceMax: { type: 'number' },
  nights: { type: 'number', description: 'Min nights' },
  nightsTo: { type: 'number', description: 'Max nights' },
  adults: { type: 'number' },
  children: { type: 'number' },
  boards: { type: 'array', items: { type: 'string' } },
  stars: { type: 'number', description: 'Minimum hotel stars' },
  departure: { type: 'string', description: 'Departure city' },
};
const criteriaSchema = { type: 'object', properties: criteriaProps };

const TOOLS = [
  {
    name: 'crm_list_reference',
    description: 'List available countries, tour operators, departure cities and board types from the CRM.',
    inputSchema: { type: 'object', properties: { force: { type: 'boolean', description: 'Bypass cache' } } },
  },
  {
    name: 'crm_search_tours',
    description: 'Search tours by criteria (price, dates, countries, operators). Returns normalized offers and saves a history snapshot.',
    inputSchema: criteriaSchema,
  },
  {
    name: 'crm_compare_operators',
    description: 'Search by criteria and return comparative analytics across tour operators (count, min/avg/median price, best offer).',
    inputSchema: criteriaSchema,
  },
  {
    name: 'crm_price_dynamics',
    description: 'Price distribution across departure dates for the criteria, plus the min-price trend across historical snapshots.',
    inputSchema: criteriaSchema,
  },
  {
    name: 'crm_monitor_diff',
    description: 'Run a fresh search for the criteria, save it, and diff against the previous snapshot (new / removed / cheaper / pricier offers).',
    inputSchema: criteriaSchema,
  },
];

const server = new Server(
  { name: 'crm-tat-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  try {
    const result = await dispatch(name, args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Error in ${name}: ${err.message}` }],
    };
  }
});

async function dispatch(name, args) {
  switch (name) {
    case 'crm_list_reference':
      return loadReference({ force: !!args.force });

    case 'crm_search_tours': {
      const offers = await searchTours(args);
      saveSnapshot(args, offers);
      return { count: offers.length, criteria: args, offers };
    }

    case 'crm_compare_operators': {
      const offers = await searchTours(args);
      saveSnapshot(args, offers);
      return { count: offers.length, ...compareOperators(offers) };
    }

    case 'crm_price_dynamics': {
      const offers = await searchTours(args);
      saveSnapshot(args, offers);
      const snaps = listSnapshots(args, 50).map((s) => ({ ...s, offers: getOffers(s.id) }));
      return { byDate: priceDynamicsByDate(offers), trend: priceTrend(snaps) };
    }

    case 'crm_monitor_diff': {
      const offers = await searchTours(args);
      saveSnapshot(args, offers);
      const [curr, prev] = lastTwoSnapshots(args); // newest first
      if (!prev) {
        return { note: 'No previous snapshot yet — baseline saved. Run again later to see changes.', baselineCount: offers.length };
      }
      return monitorDiff(prev.offers, curr.offers);
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('crm-tat-mcp server running on stdio\n');
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    await closeSession().catch(() => {});
    process.exit(0);
  });
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
