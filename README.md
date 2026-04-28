# EU Pay Transparency Directive — Member State Tracker

An interactive dashboard tracking the transposition of [Directive (EU) 2023/970](https://eur-lex.europa.eu/eli/dir/2023/970/oj/eng) (Pay Transparency Directive) across all 27 EU Member States.

Each country is classified using a traffic-light system:

| Status | Meaning |
|---|---|
| 🟢 Green | National law adopted, or final bill confirmed to enter into force on or before 7 June 2026 |
| 🟡 Amber | Bill or decree in formal consultation or before parliament; intent clear, deadline at risk |
| 🔴 Red | No formal text published, only initial steps announced — or government has signalled non-compliance |

Click any country on the map (or in the list below it) to see status details, key dates and the underlying source.

## Stack

- Static site — pure HTML, CSS, JavaScript
- [D3.js](https://d3js.org/) v7 + [topojson-client](https://github.com/topojson/topojson-client) v3 for the interactive map
- Europe TopoJSON from [leakyMirror/map-of-europe](https://github.com/leakyMirror/map-of-europe)
- Hosted on GitHub Pages

No build step. No backend. Everything renders client-side from `data.json`.

## Updating the tracker

All country information lives in [`data.json`](./data.json). To update:

1. Edit `data.json` — change `status`, `headline`, `summary`, `keyDates`, or `sources` for any country, or update `meta.lastUpdated`.
2. Commit and push to `main`.
3. GitHub Pages rebuilds automatically; the live dashboard reflects the change within ~1 minute.

### `data.json` schema

```jsonc
{
  "meta": {
    "lastUpdated": "2026-04-28",          // displayed in header & footer
    "deadlineTransposition": "2026-06-07" // drives the countdown KPI
  },
  "countries": {
    "DE": {
      "code": "DE",                       // ISO 3166-1 alpha-2
      "name": "Germany",
      "status": "red",                    // "green" | "amber" | "red"
      "headline": "Expert report November 2025; bill not yet tabled",
      "summary": "Final report of the Expert Commission published 7 November 2025…",
      "keyDates": [
        { "label": "Final Expert Commission report", "date": "2025-11-07" }
      ],
      "sources": [
        { "title": "Final Report of the Expert Commission",
          "publisher": "Freshfields",
          "url": "https://www.freshfields.com/…" }
      ]
    }
  }
}
```

Fields `directiveSources`, `trackers` and `directivePillars` are EU-wide context; edit them when EU-level guidance changes.

### Common updates

**Move a country to a new status:**
```diff
- "status": "red",
+ "status": "amber",
- "headline": "Expert report November 2025; bill not yet tabled",
+ "headline": "Government bill tabled 12 May 2026",
```

**Add a new source:**
```diff
"sources": [
  { "title": "…", "publisher": "Freshfields", "url": "…" },
+ { "title": "Cabinet Memo", "publisher": "Linklaters", "url": "https://…" }
]
```

**Bump the dashboard date:**
```diff
- "lastUpdated": "2026-04-28",
+ "lastUpdated": "2026-05-15",
```

## Local preview

```bash
npx serve . -l 4173
# or
python3 -m http.server 4173
```

Then open <http://localhost:4173>.

## Sources

Country statuses are based on publicly available legal trackers and law-firm briefings. Each country card lists its primary source(s); cross-EU trackers and the Directive text are linked from the right-hand panel of the dashboard.

## Disclaimer

This dashboard is a navigation aid, not legal advice. National transpositions are evolving rapidly — verify against the linked primary sources before acting on any specific country status.

Prepared by Korn Ferry — Reward & Benefits Practice, EMEA.
