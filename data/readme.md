# Data directory

This folder stores the static dataset that powers the catalogue. All files are committed so the site can be exported statically without runtime API calls.

## Layout

```
/data
├── additives.json
├── <slug>/
│   ├── props.json
│   └── searchHistory.json
```

- **`additives.json`** — lightweight index used during static generation. Each entry includes only the additive `title` and `eNumber`. The slug for each additive is derived from these two fields using the format `<eNumber>-<title>`, lowercased and slugified. If either field is missing the slug falls back to the available value.
- **`<slug>/props.json`** — full metadata for a single additive. Keys include:
  - `title`
  - `eNumber`
  - `synonyms`
  - `functions`
  - `description`
  - `wikipedia`
  - `wikidata`
  - `searchVolume`
  - `searchRank`
  - `searchSparkline`
  - `productCount`
- **`<slug>/searchHistory.json`** — historical monthly keyword volume returned by the Ahrefs API. This drives the search history chart on the detail page.

## Data pipeline

1. **Open Food Facts** — `scripts/fetch-additives.js` queries the Open Food Facts taxonomy to build the additive list. It normalises metadata and writes the per-additive `props.json` files alongside the updated `additives.json` index.
2. **Ahrefs keyword metrics** — `scripts/update-search-volume.js` reads the index, retrieves the latest U.S. search volume, and stores the `searchVolume` and `searchRank` values inside each additive's `props.json`.
3. **Ahrefs volume history** — `scripts/fetch-search-history.js` collects the ten-year volume trend for each additive and writes `searchHistory.json`. It also updates the `searchSparkline` array inside `props.json` for quick access on the grid view.
4. **FDC product counts** — `scripts/fetch-product-count.js` queries USDA FoodData Central to store the branded product totals for each additive title in the `productCount` field.

The scripts are idempotent and can be re-run to refresh the dataset. Each script expects the `data/` directory to exist and will create per-additive folders as needed.

## Non-E-numbered additives

Some Open Food Facts records describe ingredient families or additive blends that do not correspond to a single EU E-number. These are documented in [`non-e-numbered-additives.md`](./non-e-numbered-additives.md) so they can be reviewed or mapped to specific authorised additives without blocking enrichment scripts.
