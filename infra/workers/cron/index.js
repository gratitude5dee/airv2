/**
 * Scheduler worker replacing the eight Vercel crons in apps/web/vercel.json.
 * Each trigger GETs its /api/cron/* endpoint on app.wzrd.tech with a
 * CRON_SECRET bearer (requireCron, apps/web/lib/auth/guard.ts). The three
 * per-minute jobs share one trigger and fan out inside the invocation, so
 * six triggers cover all eight endpoints.
 */
const TARGET = "https://app.wzrd.tech";

const CRON_PATHS = {
  "* * * * *": ["/api/cron/sweep", "/api/cron/schedules", "/api/cron/trade"],
  "*/5 * * * *": ["/api/cron/publish"],
  "*/10 * * * *": ["/api/cron/ads"],
  "15 * * * *": ["/api/cron/ad-metrics"],
  "0 */6 * * *": ["/api/cron/sources"],
  "30 * * * *": ["/api/cron/health"],
};

async function run(path, env) {
  const headers = {};
  if (env.CRON_SECRET) {
    headers.authorization = `Bearer ${env.CRON_SECRET}`;
  }
  const response = await fetch(`${TARGET}${path}`, { headers });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${body.slice(0, 500)}`);
  }
  console.log(`${path}: ${response.status} ${body.slice(0, 300)}`);
}

export default {
  async scheduled(event, env, ctx) {
    const paths = CRON_PATHS[event.cron];
    if (!paths) {
      console.error(`unmapped cron expression: ${event.cron}`);
      return;
    }
    ctx.waitUntil(Promise.all(paths.map((path) => run(path, env))));
  },
};
