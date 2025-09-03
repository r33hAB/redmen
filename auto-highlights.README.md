# Auto Highlights for Redmen

This script scans your existing (proxied) Polymarket data endpoints and generates "special highlights".

## Usage
1. Install dep: `npm i openai@^4`
2. Set your key: `export OPENAI_API_KEY=sk-...`
3. Run: `node auto-highlights.mjs --window=6h --minUsd=100 --takerOnly=1 --baseUrl=http://localhost:5173`

Outputs:
- highlights.latest.json (raw highlights)
- highlights.latest.md (GPT-5 formatted list)
