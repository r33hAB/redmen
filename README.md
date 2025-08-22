# Polymarket Sports Activity – MVP

A ready-to-run React (Vite) webapp that enriches Polymarket's Activity feed for **sports** with filters and simple trend/stats, focused on trades **≥ $100**.

## Run
```bash
npm install
npm run dev
```

## APIs
- Gamma `/events` (sports filter)
- Data `/trades` (filterType=CASH, filterAmount, takerOnly)
- CLOB `/prices-history`

Debug panel in header shows request URLs and JSON snippets.
