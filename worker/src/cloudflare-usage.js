import { currentUser } from './auth.js';

const reply = (c, data, status = 200) => c.json(data, status, { 'Cache-Control': 'no-store, private' });
const utcDay = () => new Date().toISOString().slice(0, 10);
const FREE_LIMITS = Object.freeze({
  workersRequests: 100_000,
  d1RowsRead: 5_000_000,
  d1RowsWritten: 100_000,
  d1StorageBytes: 5_000_000_000,
});

// Only Cloudflare's account-level GraphQL Analytics API is queried.
// Daily values are UTC, and the response can lag behind live usage.
const WORKERS_QUERY = `query($account: string, $start: string, $end: string) {
  viewer { accounts(filter: { accountTag: $account }) {
    workersInvocationsAdaptive(limit: 10000, filter: { datetime_geq: $start, datetime_leq: $end }) {
      dimensions { scriptName }
      sum { requests }
    }
  } }
}`;
const D1_QUERY = `query($account: string, $day: Date) {
  viewer { accounts(filter: { accountTag: $account }) {
    d1AnalyticsAdaptiveGroups(limit: 1000, filter: { date_geq: $day, date_leq: $day }) {
      dimensions { databaseId }
      sum { rowsRead rowsWritten }
    }
  } }
}`;

async function queryAnalytics(env, query, variables) {
  const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + env.CLOUDFLARE_ANALYTICS_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) throw new Error('GRAPHQL_HTTP_ERROR');
  const data = await response.json();
  if (data.errors?.length) throw new Error('GRAPHQL_QUERY_ERROR');
  const accounts = data.data?.viewer?.accounts;
  if (!Array.isArray(accounts) || accounts.length !== 1) throw new Error('ACCOUNT_NOT_AVAILABLE');
  return accounts[0];
}

function addUp(rows, field) {
  let sum = 0;
  for (const row of rows) {
    const value = row?.sum?.[field];
    if (value == null || !Number.isFinite(Number(value))) return null;
    sum += Number(value);
  }
  return sum;
}

export function registerCloudflareUsage(app) {
  app.get('/api/cloudflare/usage', async c => {
    if (!await currentUser(c)) return reply(c, { error: 'Unauthorized' }, 401);
    const env = c.env;
    const configured = Boolean(env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_ANALYTICS_TOKEN);
    // Never infer a billing plan from a static default or the Worker URL.
    const plan = env.CLOUDFLARE_WORKERS_PLAN === 'free' ? 'free'
      : env.CLOUDFLARE_WORKERS_PLAN === 'paid' ? 'paid' : 'unknown';
    const date = utcDay();
    const result = {
      configured,
      plan,
      limits: plan === 'free' ? FREE_LIMITS : null,
      period: { date, timezone: 'UTC' },
      account: { workersRequests: null, d1RowsRead: null, d1RowsWritten: null, d1StorageBytes: null },
      project: { workersRequests: null, d1RowsRead: null, d1RowsWritten: null, d1StorageBytes: null },
      errors: [],
    };
    if (!configured) return reply(c, result);
    if (!/^[a-f0-9]{32}$/i.test(env.CLOUDFLARE_ACCOUNT_ID)) {
      result.errors.push('INVALID_ACCOUNT_CONFIG');
      return reply(c, result);
    }
    const account = env.CLOUDFLARE_ACCOUNT_ID;
    const variables = { account, start: date + 'T00:00:00.000Z', end: new Date().toISOString() };
    const [workers, d1] = await Promise.allSettled([
      queryAnalytics(env, WORKERS_QUERY, variables),
      queryAnalytics(env, D1_QUERY, { account, day: date }),
    ]);

    const workerRows = workers.status === 'fulfilled' ? workers.value.workersInvocationsAdaptive : null;
    if (Array.isArray(workerRows) && workerRows.length < 10_000) {
      const workerName = env.CLOUDFLARE_WORKER_NAME || 'qr-smart-link-lite';
      result.account.workersRequests = addUp(workerRows, 'requests');
      result.project.workersRequests = addUp(
        workerRows.filter(r => r.dimensions?.scriptName === workerName), 'requests',
      );
    } else result.errors.push(workerRows?.length >= 10_000 ? 'WORKERS_PARTIAL' : 'WORKERS_UNAVAILABLE');

    const d1Rows = d1.status === 'fulfilled' ? d1.value.d1AnalyticsAdaptiveGroups : null;
    if (Array.isArray(d1Rows) && d1Rows.length < 1_000) {
      result.account.d1RowsRead = addUp(d1Rows, 'rowsRead');
      result.account.d1RowsWritten = addUp(d1Rows, 'rowsWritten');
      // The D1 database ID must be configured for reliable per-project attribution.
      if (env.DB_DATABASE_ID && /^[a-f0-9-]{36}$/i.test(env.DB_DATABASE_ID)) {
        const own = d1Rows.filter(r => r.dimensions?.databaseId === env.DB_DATABASE_ID);
        result.project.d1RowsRead = addUp(own, 'rowsRead');
        result.project.d1RowsWritten = addUp(own, 'rowsWritten');
      }
    } else result.errors.push(d1Rows?.length >= 1_000 ? 'D1_PARTIAL' : 'D1_UNAVAILABLE');
    // D1 total storage requires a separate storage data source.
    // Do not extrapolate it from daily row counts.
    return reply(c, result);
  });
}

[executed on device: LAPTOP-96QI0EC3 (2df899ff-6916-4249-9617-10636bdf2880)]
