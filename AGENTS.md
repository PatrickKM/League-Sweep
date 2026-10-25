# League-Sweep

- Run locally: create `.env` with `CITO_API_KEY=...`, then `node server.js` → http://localhost:3000 (Node 24+, no deps).
- GitHub Pages: `.github/workflows/pages.yml` runs `node server.js --build _site` with the `CITO_API_KEY` repo secret, writing static `api/schedule` + `api/standings` snapshots. Data refreshes only when it runs: on push to main, or manually via the "Refresh data" workflow (`refresh.yml`, calls `pages.yml`). The page's Refresh button only shows on localhost.
- `server.js` proxies Cito (`/api/schedule`, `/api/standings`) so the key never reaches the browser. Cached 60s.
- Owners: `owners.json`, keyed by team `code` from the Cito schedule (e.g. `TLAW`, not `TL`). Exception: Cito's `ML` is renamed to `LOS` in `index.html`.
- Fonts in `fonts/` are Riot's official Beaufort for LoL + Spiegel (from leagueoflegends.com downloads page), served by `server.js`.
- Worlds IDs: league `lol-worlds`, tournament `lol-worlds_2026`. Riot standings may be empty; the page derives W-L from the schedule then.
