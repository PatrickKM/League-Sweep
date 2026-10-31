// Local-only server: serves the bracket and proxies Cito so the API key never reaches the browser.
// `node server.js --build <dir>` instead writes <dir>/api/{schedule,standings} once, for GitHub Pages.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
const KEY = process.env.CITO_API_KEY;
if (!KEY) throw new Error('CITO_API_KEY missing (set it in .env, or as a GitHub Actions secret)');

const BASE = 'https://api.citoapi.com/api/v1/lol/leagues/lol-worlds';
const TOURNAMENT = 'lol-worlds_2026';
const PORT = process.env.PORT || 3000;
const cache = {}; // kept until the page's Refresh button sends ?refresh=1, so reloads never hit Cito

async function cito(url) {
  const res = await fetch(url, { headers: { 'x-api-key': KEY } });
  if (!res.ok) throw new Error(`Cito ${res.status}: ${(await res.json().catch(() => ({}))).error?.message ?? res.statusText}`);
  return res.json();
}

const routes = {
  async schedule() {
    const events = [];
    for (let offset = 0; ; offset += 50) {
      const { data } = await cito(`${BASE}/schedule?from=2026-10-01&limit=50&offset=${offset}`);
      events.push(...data.events.filter(e => e.tournamentId === TOURNAMENT));
      if (!data.hasMore) return events;
    }
  },
  async standings() {
    return (await cito(`${BASE}/standings?tournamentId=${TOURNAMENT}`)).data;
  },
};

const buildDir = process.argv[process.argv.indexOf('--build') + 1];
if (process.argv.includes('--build')) {
  const apiDir = path.join(buildDir, 'api');
  fs.mkdirSync(apiDir, { recursive: true });
  Promise.all(Object.entries(routes).map(async ([name, fn]) => fs.writeFileSync(path.join(apiDir, name), JSON.stringify(await fn()))))
    .then(() => console.log(`Wrote ${apiDir}`));
  return;
}

const files = { '/': 'index.html', '/owners.json': 'owners.json', '/overrides.json': 'overrides.json' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const send = (code, type, body) => { res.writeHead(code, { 'content-type': type }); res.end(body); };
  try {
    if (files[url.pathname]) {
      const file = files[url.pathname];
      return send(200, file.endsWith('.json') ? 'application/json' : 'text/html', fs.readFileSync(path.join(__dirname, file)));
    }
    if (/^\/fonts\/[\w-]+\.ttf$/.test(url.pathname)) return send(200, 'font/ttf', fs.readFileSync(path.join(__dirname, url.pathname)));
    const name = url.pathname.match(/^\/api\/(\w+)$/)?.[1];
    if (!routes.hasOwnProperty(name)) return send(404, 'text/plain', 'Not found');
    if (!cache[name] || url.searchParams.has('refresh')) cache[name] = { at: new Date().toISOString(), body: JSON.stringify(await routes[name]()) };
    res.setHeader('x-fetched-at', cache[name].at);
    send(200, 'application/json', cache[name].body);
  } catch (err) {
    console.error(err);
    send(502, 'application/json', JSON.stringify({ error: err.message }));
  }
}).listen(PORT, '127.0.0.1', () => console.log(`Worlds 2026 bracket: http://localhost:${PORT}`));
